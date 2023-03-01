import sys
import traceback
import pandas as pd
import statistics
import os
import plotly as py
import json
import pymongo
import base64
import math

from plotly.graph_objs import Data
from lifelines import KaplanMeierFitter
from lifelines import WeibullAFTFitter
from lifelines import LogNormalAFTFitter
from lifelines import CoxPHFitter
from lifelines.statistics import proportional_hazard_test
from matplotlib import pyplot as plt
from io import BytesIO
from scipy.stats import norm
from os import listdir
from python_nctu_cancer.settings import CUSTOM_SETTINGS


class MoreGene:
    path = os.path.abspath(os.path.dirname(__name__)) + \
        os.sep + "python_nctu_cancer" + os.sep
    #path = 'C:\\Users\\user\\Desktop\\Projects\\python_nctu_cancer\\python_nctu_cancer\\'

    mongodb_conn = None

    def __init__(self):
        self.mongodb_conn = self.get_mongodb_conn()

    def get_mongodb_conn(self):
        mongodb_connection = CUSTOM_SETTINGS["MONGODB"]
        username = mongodb_connection["username"]
        password = mongodb_connection["password"]
        address = mongodb_connection["address"]
        port = mongodb_connection["port"]
        db = mongodb_connection["db"]

        connection_string = "mongodb://{}:{}@{}:{}/{}".format(
            username, password, address, port, db)
        mongo_client = pymongo.MongoClient(host=connection_string)
        mongo_db = mongo_client[db]
        return mongo_db

    def get_exp_df(self, type, category, genes):
        mongo_col = self.mongodb_conn["cancer_genome_"+category]
        myquery = {
            'type': type
        }
        if category in ["lncrna"]:
            index = "gene_symbol"
        else:
            index = "MetaFeature"

        tmps = []
        for gene in genes:
            tmps.append("(^" + gene + "([;|,])|^" + gene + "$)")
        name = "|".join(tmps)
        
        myquery[index] = { "$regex": f"{name}", "$options": "i" }

        data = list(mongo_col.find(myquery, {'_id': False}))

        # Forcing change MetaFeature value
        for i, d in enumerate(data):
            for k in data[i]:
                if k not in ["MetaFeature"]:
                    continue
                val = data[i][k]
                if val.find("|") != -1:
                    val = val.split("|")[0]
                elif val.find(",") != -1:
                    val = val.split(",")[0]
                data[i][k] = val
                
        return pd.DataFrame(data)

    def get_exp1(self, df1, df2, gene):
        temp = df1['Hybridization REF'].tolist()
        #temp = [x.lower()[:12] for x in temp]
        exp = df2.iloc[0].tolist()

        a = list(df2.columns.values)
        a = [i.lower()[:12] for i in a]
        dic1 = dict(zip(a, exp))

        templist = []
        for x in temp:
            if x in dic1:
                templist.append(dic1[x])
            else:
                templist.append(float('nan'))

        df1[gene] = templist

        return df1

    def get_exp_lncrna(self, df1, df2, gene):
        temp = df1['Hybridization REF'].tolist()
        # temp = [x.lower()[:12] for x in temp]
        exp = df2.iloc[0].tolist()

        a = list(df2.columns.values)
        a = [i.lower()[:12] for i in a]
        dic1 = dict(zip(a, exp))

        templist = []
        for x in temp:
            if x in dic1:
                templist.append(dic1[x])
            else:
                templist.append(float('nan'))

        df1[gene] = templist

        return df1

    def drop_nan(self, df1, gene):

        df1 = df1.dropna(subset=[gene])
        df1 = df1[df1[gene] != 'NA']
        df1 = df1[df1[gene] != 'NaN']
        return df1

    def cox(self, df, sur, list):
        df.rename(columns={"years_to_birth": "Age at diagnosis", "pathologic_stage": "Stage", "gender": 'Sex'},
                  inplace=True)

        df.drop(['Hybridization REF'], axis=1, inplace=True)
        cox = CoxPHFitter()

        cox.fit(df, duration_col='days_'+sur, event_col=sur+'_status')
        summary_df = cox.summary

        # format and replace value
        tmp_df = summary_df.to_dict('index')
        for key, value in tmp_df.items():
            value["p"] = format(value["p"], ".2E")
            value["coef"] = format(value["coef"], ".2E")
            value["survival_type"] = sur
            try:
                value["exp(coef) upper 95%"] = format(value["exp(coef) upper 95%"])
            except:
                value["exp(coef) upper 95%"] = 0
            tmp_df[key] = value

        return tmp_df

    def cox_img(self, df, sur, list, drop_image_columns):
        drop_image_columns += ['Hybridization REF']
        df.rename(columns={"years_to_birth": "Age at diagnosis", "pathologic_stage": "Stage", "gender": 'Sex'},
                  inplace=True)

        df.columns = df.columns.str.split(',').str[0]
        df.columns = df.columns.str.split('|').str[0]

        df.drop(drop_image_columns, axis=1, inplace=True)
        cox = CoxPHFitter()

        cox.fit(df, duration_col='days_'+sur, event_col=sur+'_status')
        cox.plot()
        summary_df = cox.summary
        
        n = str(df.shape[0])

        # 轉成圖片的步驟
        sio = BytesIO()

        #plt.title('(n='+n+')')
        plt.xlabel("log (Hazard Ratio) (95% CI)")
        plt.title('Hazard Ratio Plot' + ' (' + sur + ', ' + 'n=' + n + ')')
        plt.savefig(sio, format='png', dpi=300, bbox_inches='tight')
        data = base64.encodebytes(sio.getvalue()).decode()

        html = '''
            <img class="aftImg" src="data:image/png;base64,{}" />
        '''.format(data)
        plt.close()

        # PH assumption
        results = proportional_hazard_test(cox, df, time_transform='rank')
        # results.print_summary(decimals=3)
        test_summary = results.__dict__
        test_summary = json.loads(json.dumps(test_summary, cls = py.utils.PlotlyJSONEncoder))

        # format and replace value
        tmp_df = summary_df.to_dict('index')
        for key, value in tmp_df.items():
            value["p"] = format(value["p"], ".2E")
            value["coef"] = format(value["coef"], ".2E")
            value["survival_type"] = sur
            if math.isinf(value["exp(coef) upper 95%"]):
                value["exp(coef) upper 95%"] = 1
            tmp_df[key] = value

        return [html, tmp_df, test_summary]

    def aft(self, df, sur, list):

        df.drop(['Hybridization REF'], axis=1, inplace=True)
        df.rename(columns={"years_to_birth": "Age at diagnosis", "pathologic_stage": "Stage", "gender": 'Sex'},
                  inplace=True)
        

        aft = LogNormalAFTFitter()

        aft.fit(df, duration_col='days_' + sur, event_col=sur + '_status')

        summary_df = aft.summary

        tmp_df = {}
        for index, row in summary_df.iterrows():
            tmp = {}
            for key, value in row.items():
                tmp[key] = value
                
            tmp["p"] = format(tmp["p"], ".2E")
            tmp["coef"] = format(tmp["coef"], ".2E")
            try:
                tmp["exp(coef) upper 95%"] = format(tmp["exp(coef) upper 95%"])
            except:
                tmp["exp(coef) upper 95%"] = 0

            tmp_df[index[1]] = tmp

        return tmp_df

    def aft_img(self, df, sur, list, drop_image_columns):
        drop_image_columns += ['Hybridization REF']
        df.rename(columns={"years_to_birth": "Age at diagnosis", "pathologic_stage": "Stage", "gender": 'Sex'},
                  inplace=True)
        df.columns = df.columns.str.split(',').str[0]
        df.columns = df.columns.str.split('|').str[0]

        df.drop(drop_image_columns, axis=1, inplace=True)

        aft = LogNormalAFTFitter()

        aft.fit(df, duration_col='days_' + sur, event_col=sur + '_status')
        aft.plot()

        summary_df = aft.summary
        
        n = str(df.shape[0])

        # 轉成圖片的步驟
        sio = BytesIO()

        #plt.title('(n='+n+')')
        plt.xlabel("log (Time Ratio) (95% CI)")
        plt.title('Time Ratio Plot' + ' (' + sur + ', ' + 'n=' + n + ')')
        plt.savefig(sio, format='png', dpi=300, bbox_inches='tight')
        data = base64.encodebytes(sio.getvalue()).decode()

        html = '''
            <img class="aftImg" src="data:image/png;base64,{}" />
        '''.format(data)
        plt.close()

        tmp_df = {}
        for index, row in summary_df.iterrows():
            tmp = {}
            for key, value in row.items():
                tmp[key] = value
                
            tmp["p"] = format(tmp["p"], ".2E")
            tmp["coef"] = format(tmp["coef"], ".2E")
            tmp_df[index[1]] = tmp

        return [html, tmp_df]

    def transform(self, df, gene):
        ex = df[gene]
        ex = pd.to_numeric(ex)
        newex = ex.rank(method='first').tolist()

        temp = []
        for x in range(len(newex)):
            temp.append(norm.ppf((newex[x] - 0.5) / len(newex)))
        df[gene] = temp
        return df

    def transform2(self, df, num, gene):
        ex = df['Gene2']
        ex = pd.to_numeric(ex)
        newex = ex.rank(method='first').tolist()

        for x in range(len(newex)):
            df.iat[x, -1] = norm.ppf((newex[x] - 0.5) / len(newex))
        return df

    # 取得cox檔案路徑
    def get_cox_path(self, target_path, target_file):
        
        for idx, p in enumerate(listdir(target_path)):
            t = target_path + os.sep + p
            if os.path.isdir(t):
                res = self.get_cox_path(t + os.sep, target_file)
                if res is not None:
                    return res
            else:
                if os.path.isfile(target_path + target_file):
                    return target_path + target_file
        return None

    def get_cox_data(self, cancer_type, gene_mrnas, gene_mirnas, gene_lncrnas):
        modes = ['OS','DFI','PFI','DSS']
        
        exp_mrna = []
        exp_mirna = []
        exp_lncrna = []
        if len(gene_mrnas) > 0:
            exp_mrna = self.get_exp_df(cancer_type, 'mrna', gene_mrnas)
        if len(gene_mirnas) > 0:
            exp_mirna = self.get_exp_df(cancer_type, 'mirna', gene_mirnas)
        if len(gene_lncrnas) > 0:
            exp_lncrna = self.get_exp_df(cancer_type, 'lncrna', gene_lncrnas)
        
        print(exp_mirna)
        data = {}
        for mode in modes:
            data[mode] = {}
            try:
                # 取得指定存在檔案路徑
                target_path = self.path + "Cox_parsedata" + os.sep
                target_path += mode + "_parsedata" + os.sep

                cox_path = self.get_cox_path(target_path, cancer_type + "output.txt")
                new_df = pd.read_csv(cox_path, sep='\t')
                # print(exp_lncrna)
                # 所有input合併成一個new_df
                for x in gene_mrnas:
                    new_df = self.get_exp1(
                        new_df, exp_mrna[exp_mrna['MetaFeature'] == x], x)

                for x in gene_mirnas:
                    new_df = self.get_exp1(
                        new_df, exp_mirna[exp_mirna['MetaFeature'] == x], x)

                for x in gene_lncrnas:
                    new_df = self.get_exp_lncrna(
                        new_df, exp_lncrna[exp_lncrna['gene_symbol'] == x], x)

                all = gene_mrnas + gene_mirnas + gene_lncrnas
                for x in all:
                    new_df = self.drop_nan(new_df, x)

                #num = new_df.shape[1]
                for x in all:
                    new_df = self.transform(new_df, x)
                # print(new_df)

                #new_df = transform2(new_df, num)

                # 3
                # 4
                # print(new_df.shape[0])
                #####5,6,7,8(cox, aft)
                data[mode] = self.cox(new_df, mode, all)
                data[mode]["patients"] = new_df.shape[0]
            except Exception as e:
                print("exception =", str(e))
                
        return data

    def get_aft_data(self, cancer_type, gene_mrnas, gene_mirnas, gene_lncrnas):
        modes = ['OS','DFI','PFI','DSS']
        
        exp_mrna = []
        exp_mirna = []
        exp_lncrna = []
        if len(gene_mrnas) > 0:
            exp_mrna = self.get_exp_df(cancer_type, 'mrna', gene_mrnas)
        if len(gene_mirnas) > 0:
            exp_mirna = self.get_exp_df(cancer_type, 'mirna', gene_mirnas)
        if len(gene_lncrnas) > 0:
            exp_lncrna = self.get_exp_df(cancer_type, 'lncrna', gene_lncrnas)
        
        data = {}
        for mode in modes:
            data[mode] = {}
            try:
                # 取得指定存在檔案路徑
                target_path = self.path + "Cox_parsedata" + os.sep
                target_path += mode + "_parsedata" + os.sep

                cox_path = self.get_cox_path(target_path, cancer_type + "output.txt")
                new_df = pd.read_csv(cox_path, sep='\t')
                # print(exp_lncrna)
                # 所有input合併成一個new_df
                for x in gene_mrnas:
                    new_df = self.get_exp1(
                        new_df, exp_mrna[exp_mrna['MetaFeature'] == x], x)

                for x in gene_mirnas:
                    new_df = self.get_exp1(
                        new_df, exp_mirna[exp_mirna['MetaFeature'] == x], x)

                for x in gene_lncrnas:
                    new_df = self.get_exp_lncrna(
                        new_df, exp_lncrna[exp_lncrna['gene_symbol'] == x], x)

                all = gene_mrnas + gene_mirnas + gene_lncrnas
                for x in all:
                    new_df = self.drop_nan(new_df, x)

                #num = new_df.shape[1]
                for x in all:
                    new_df = self.transform(new_df, x)
                # print(new_df)

                #new_df = transform2(new_df, num)

                # 3
                # 4
                # print(new_df.shape[0])
                #####5,6,7,8(cox, aft)
                data[mode] = self.aft(new_df, mode, all)
                data[mode]["patients"] = new_df.shape[0]
            except Exception as e:
                print("exception =", str(e))
                
        return data

    def get_cox_img_data(self, cancer_type, mode, gene_mrnas, gene_mirnas, gene_lncrnas, drop_image_columns):
        
        exp_mrna = []
        exp_mirna = []
        exp_lncrna = []
        if len(gene_mrnas) > 0:
            exp_mrna = self.get_exp_df(cancer_type, 'mrna', gene_mrnas)
        if len(gene_mirnas) > 0:
            exp_mirna = self.get_exp_df(cancer_type, 'mirna', gene_mirnas)
        if len(gene_lncrnas) > 0:
            exp_lncrna = self.get_exp_df(cancer_type, 'lncrna', gene_lncrnas)
        
        data = {}
        try:
            # 取得指定存在檔案路徑
            target_path = self.path + "Cox_parsedata" + os.sep
            target_path += mode + "_parsedata" + os.sep

            cox_path = self.get_cox_path(target_path, cancer_type + "output.txt")
            new_df = pd.read_csv(cox_path, sep='\t')
            # print(exp_lncrna)
            # 所有input合併成一個new_df
            for x in gene_mrnas:
                new_df = self.get_exp1(
                    new_df, exp_mrna[exp_mrna['MetaFeature'] == x], x)

            for x in gene_mirnas:
                new_df = self.get_exp1(
                    new_df, exp_mirna[exp_mirna['MetaFeature'] == x], x)

            for x in gene_lncrnas:
                new_df = self.get_exp_lncrna(
                    new_df, exp_lncrna[exp_lncrna['gene_symbol'] == x], x)

            all = gene_mrnas + gene_mirnas + gene_lncrnas
            for x in all:
                new_df = self.drop_nan(new_df, x)

            #num = new_df.shape[1]
            for x in all:
                new_df = self.transform(new_df, x)
            # print(new_df)

            #new_df = transform2(new_df, num)

            # 3
            # 4
            # print(new_df.shape[0])
            #####5,6,7,8(cox, aft)
            data = self.cox_img(new_df, mode, all, drop_image_columns)
        except Exception as e:
            print("exception =", str(e))

        return data

    def get_aft_img_data(self, cancer_type, mode, gene_mrnas, gene_mirnas, gene_lncrnas, drop_image_columns):
        
        exp_mrna = []
        exp_mirna = []
        exp_lncrna = []
        if len(gene_mrnas) > 0:
            exp_mrna = self.get_exp_df(cancer_type, 'mrna', gene_mrnas)
        if len(gene_mirnas) > 0:
            exp_mirna = self.get_exp_df(cancer_type, 'mirna', gene_mirnas)
        if len(gene_lncrnas) > 0:
            exp_lncrna = self.get_exp_df(cancer_type, 'lncrna', gene_lncrnas)
        
        data = {}
        try:
            # 取得指定存在檔案路徑
            target_path = self.path + "Cox_parsedata" + os.sep
            target_path += mode + "_parsedata" + os.sep

            cox_path = self.get_cox_path(target_path, cancer_type + "output.txt")
            new_df = pd.read_csv(cox_path, sep='\t')
            # print(exp_lncrna)
            # 所有input合併成一個new_df
            for x in gene_mrnas:
                new_df = self.get_exp1(
                    new_df, exp_mrna[exp_mrna['MetaFeature'] == x], x)

            for x in gene_mirnas:
                new_df = self.get_exp1(
                    new_df, exp_mirna[exp_mirna['MetaFeature'] == x], x)

            for x in gene_lncrnas:
                new_df = self.get_exp_lncrna(
                    new_df, exp_lncrna[exp_lncrna['gene_symbol'] == x], x)

            all = gene_mrnas + gene_mirnas + gene_lncrnas
            for x in all:
                new_df = self.drop_nan(new_df, x)

            #num = new_df.shape[1]
            for x in all:
                new_df = self.transform(new_df, x)
            # print(new_df)

            #new_df = transform2(new_df, num)

            # 3
            # 4
            # print(new_df.shape[0])
            #####5,6,7,8(cox, aft)
            data = self.aft_img(new_df, mode, all, drop_image_columns)
        except Exception as e:
            print("exception =", str(e))
                
        return data

    def get_cox_upload_img_data(self, cancer_type, mode, gene_mrnas, gene_mirnas, gene_lncrnas, upload_file):
        
        exp_mrna = []
        exp_mirna = []
        exp_lncrna = []
        all_genes = gene_mrnas + gene_mirnas + gene_lncrnas
        if len(gene_mrnas) > 0:
            exp_mrna = self.get_exp_df(cancer_type, 'mrna', gene_mrnas)
        if len(gene_mirnas) > 0:
            exp_mirna = self.get_exp_df(cancer_type, 'mirna', gene_mirnas)
        if len(gene_lncrnas) > 0:
            exp_lncrna = self.get_exp_df(cancer_type, 'lncrna', gene_lncrnas)
        
        data = {}
        try:
            new_df = pd.read_csv(upload_file, delimiter=',')
            new_df.to_csv(index=False)

            # drop what the extra added columns
            df_len = len(new_df.columns)
            if df_len < 21:
                raise Exception("File columns lack of some titles")
            drop_indexes = []
            for i in range(df_len - 20, df_len):
                drop_indexes.append(i)
            new_df.drop(new_df.columns[drop_indexes],axis=1,inplace=True)

            # check if match title and number correctly.
            possible_headers = ['Hybridization REF', 'years_to_birth', 'pathologic_stage', 'gender',
                'OS_status', 'days_OS', 'DFI_status', 'days_DFI', 'PFI_status', 'days_PFI', 'DSS_status', 'days_DSS']
            headers = list(new_df.head(0))
            header_subtract = list(set(headers) - set(all_genes) - set(possible_headers))
            if len(header_subtract) > 0:
                raise Exception("The selected genes does not match the names of the file.")

            # print(exp_lncrna)
            # 所有input合併成一個new_df
            for x in gene_mrnas:
                new_df = self.get_exp1(
                    new_df, exp_mrna[exp_mrna['MetaFeature'] == x], x)

            for x in gene_mirnas:
                new_df = self.get_exp1(
                    new_df, exp_mirna[exp_mirna['MetaFeature'] == x], x)

            for x in gene_lncrnas:
                new_df = self.get_exp_lncrna(
                    new_df, exp_lncrna[exp_lncrna['gene_symbol'] == x], x)

            all = gene_mrnas + gene_mirnas + gene_lncrnas
            for x in all:
                new_df = self.drop_nan(new_df, x)

            #num = new_df.shape[1]
            for x in all:
                new_df = self.transform(new_df, x)
            # print(new_df)

            #new_df = transform2(new_df, num)

            # 3
            # 4
            # print(new_df.shape[0])
            #####5,6,7,8(cox, aft)
            data = self.cox_img(new_df, mode, all, [])
        except Exception as e:
            print("exception =", str(e))
            raise Exception(str(e))

        return data

    def get_aft_upload_img_data(self, cancer_type, mode, gene_mrnas, gene_mirnas, gene_lncrnas, upload_file):
        
        exp_mrna = []
        exp_mirna = []
        exp_lncrna = []
        all_genes = gene_mrnas + gene_mirnas + gene_lncrnas
        if len(gene_mrnas) > 0:
            exp_mrna = self.get_exp_df(cancer_type, 'mrna', gene_mrnas)
        if len(gene_mirnas) > 0:
            exp_mirna = self.get_exp_df(cancer_type, 'mirna', gene_mirnas)
        if len(gene_lncrnas) > 0:
            exp_lncrna = self.get_exp_df(cancer_type, 'lncrna', gene_lncrnas)
        
        data = {}
        try:
            new_df = pd.read_csv(upload_file, delimiter=',')
            new_df.to_csv(index=False)

            # drop what the extra added columns
            df_len = len(new_df.columns)
            if df_len < 21:
                raise Exception("File columns lack of some titles")
            drop_indexes = []
            for i in range(df_len - 20, df_len):
                drop_indexes.append(i)
            new_df.drop(new_df.columns[drop_indexes],axis=1,inplace=True)

            # check if match title and number correctly.
            possible_headers = ['Hybridization REF', 'years_to_birth', 'pathologic_stage', 'gender',
                'OS_status', 'days_OS', 'DFI_status', 'days_DFI', 'PFI_status', 'days_PFI', 'DSS_status', 'days_DSS']
            headers = list(new_df.head(0))
            header_subtract = list(set(headers) - set(all_genes) - set(possible_headers))
            if len(header_subtract) > 0:
                raise Exception("The selected genes does not match the names of the file.")

            # print(exp_lncrna)
            # 所有input合併成一個new_df
            for x in gene_mrnas:
                new_df = self.get_exp1(
                    new_df, exp_mrna[exp_mrna['MetaFeature'] == x], x)

            for x in gene_mirnas:
                new_df = self.get_exp1(
                    new_df, exp_mirna[exp_mirna['MetaFeature'] == x], x)

            for x in gene_lncrnas:
                new_df = self.get_exp_lncrna(
                    new_df, exp_lncrna[exp_lncrna['gene_symbol'] == x], x)

            all = gene_mrnas + gene_mirnas + gene_lncrnas
            for x in all:
                new_df = self.drop_nan(new_df, x)

            #num = new_df.shape[1]
            for x in all:
                new_df = self.transform(new_df, x)
            # print(new_df)

            #new_df = transform2(new_df, num)

            # 3
            # 4
            # print(new_df.shape[0])
            #####5,6,7,8(cox, aft)
            data = self.aft_img(new_df, mode, all, [])
        except Exception as e:
            print("exception =", str(e))
            raise Exception(str(e))
                
        return data

    def get_download_data(self, cancer_type, mode, gene_mrnas, gene_mirnas, gene_lncrnas):
        
        exp_mrna = []
        exp_mirna = []
        exp_lncrna = []
        if len(gene_mrnas) > 0:
            exp_mrna = self.get_exp_df(cancer_type, 'mrna', gene_mrnas)
        if len(gene_mirnas) > 0:
            exp_mirna = self.get_exp_df(cancer_type, 'mirna', gene_mirnas)
        if len(gene_lncrnas) > 0:
            exp_lncrna = self.get_exp_df(cancer_type, 'lncrna', gene_lncrnas)
        
        try:
            # 取得指定存在檔案路徑
            target_path = self.path + "Cox_parsedata" + os.sep
            target_path += mode + "_parsedata" + os.sep

            cox_path = self.get_cox_path(target_path, cancer_type + "output.txt")
            new_df = pd.read_csv(cox_path, sep='\t')
            # print(exp_lncrna)
            # 所有input合併成一個new_df
            for x in gene_mrnas:
                new_df = self.get_exp1(
                    new_df, exp_mrna[exp_mrna['MetaFeature'] == x], x)

            for x in gene_mirnas:
                new_df = self.get_exp1(
                    new_df, exp_mirna[exp_mirna['MetaFeature'] == x], x)

            for x in gene_lncrnas:
                new_df = self.get_exp_lncrna(
                    new_df, exp_lncrna[exp_lncrna['gene_symbol'] == x], x)

            all = gene_mrnas + gene_mirnas + gene_lncrnas
            for x in all:
                new_df = self.drop_nan(new_df, x)

            #num = new_df.shape[1]
            for x in all:
                new_df = self.transform(new_df, x)
            # print(new_df)

            #new_df = transform2(new_df, num)

            # append new column data
            path = os.path.abspath(os.path.dirname(__name__)) + \
                os.sep + "python_nctu_cancer" + os.sep
            excel_df = pd.read_excel(
                path + 'Supplemental/TCGA-CDR-SupplementalTableS1.xlsx')
            patient_mappings = {}
            headers = []
            for index, row in excel_df.head().iterrows():
                for items in row.iteritems():
                    headers.append(items[0])

            for index, row in excel_df.iterrows():
                bcr_patient_barcode = row[1].upper()
                patient_mappings[bcr_patient_barcode] = row

            append_data = {}
            for j in range(20):
                header = headers[j + 5]
                append_data[header] = []
            for row in new_df.iterrows():
                bcr_patient_barcode = row[1][0].upper()
                if bcr_patient_barcode in patient_mappings:
                    patient_data = patient_mappings[bcr_patient_barcode]
                    for j in range(20):
                        header = headers[j + 5]
                        append_data[header].append(patient_data[j + 5])
                else:
                    for j in range(20):
                        header = headers[j + 5]
                        append_data[header].append("")

            for key, d in enumerate(append_data):
                new_df[d] = append_data[d]

            return new_df
        except Exception as e:
            print("exception =", str(e))
                
        return ""