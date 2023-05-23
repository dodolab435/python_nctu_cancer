import sys
import traceback
import os
import base64
import pandas as pd
import statistics
import plotly as py
import json
import pymongo
import numpy as np

from python_nctu_cancer.settings import CUSTOM_SETTINGS
from lifelines import KaplanMeierFitter
from lifelines import WeibullAFTFitter
from lifelines import LogNormalAFTFitter
from plotly.graph_objs import Data
from lifelines import CoxPHFitter
from lifelines.statistics import proportional_hazard_test
from matplotlib import pyplot as plt
from io import BytesIO
from scipy.stats import norm
from os import listdir

class CoxAftTwoGene:
    path =  os.path.abspath(os.path.dirname(__name__)) + os.sep + "python_nctu_cancer" + os.sep
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

        connection_string = "mongodb://{}:{}@{}:{}/{}".format(username, password, address, port, db)
        mongo_client = pymongo.MongoClient(host=connection_string)
        mongo_db = mongo_client[db]
        return mongo_db

    def get_exp_df(self, type, category, gene):
        mongo_col = self.mongodb_conn["cancer_genome_" + category]
        myquery = {
            'type': type
        }
        if category == "lncrna":
            myquery["gene_symbol"] = gene
        else:
            myquery["MetaFeature"] = {"$regex": f"(^{gene}([;|,]))|^({gene})$"}

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

    def get_exp1(self, df1, df2):
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

        df1['Gene1'] = templist

        return df1

    def get_exp2(self, df1, df2):
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

        df1['Gene2'] = templist

        return df1

    def drop_nan(self, df1):

        df1 = df1.dropna(subset=["Gene1"])
        df1 = df1[df1["Gene1"] != 'NA']
        df1 = df1[df1["Gene1"] != 'NaN']

        df1 = df1.dropna(subset=["Gene2"])
        df1 = df1[df1["Gene2"] != 'NA']
        df1 = df1[df1["Gene2"] != 'NaN']

        return df1

    def cox(self, df, sur):

        df.drop(['Hybridization REF'], axis=1, inplace=True)
        cox = CoxPHFitter()

        cox.fit(df, duration_col='days_'+sur, event_col=sur+'_status')
        summary_df = cox.summary

        #print(type(summary_df))

        # birth_coef = str(round(float(summary_df.loc[('years_to_birth')]['coef']), 3))
        # birth_p_val = str(round(float(summary_df.loc[('years_to_birth')]['p']), 3))
        # gender_coef = str(round(float(summary_df.loc[('gender')]['coef']), 3))
        # gender_p_val = str(round(float(summary_df.loc[('gender')]['p']), 3))
        # stage_coef = str(round(float(summary_df.loc[('pathologic_stage')]['coef']), 3))
        # stage_p_val = str(round(float(summary_df.loc[('pathologic_stage')]['p']), 3))
        Gene1_coef = str(float(summary_df.loc[('Gene1')]['coef']))
        Gene1_p_val = str(float(summary_df.loc[('Gene1')]['p']))
        Gene2_coef = str(float(summary_df.loc[('Gene2')]['coef']))
        Gene2_p_val = str(float(summary_df.loc[('Gene2')]['p']))

        results = proportional_hazard_test(cox, df, time_transform='rank')
        #results.print_summary(decimals=3)
        test_summary = results.__dict__
        # test_dic = dict(zip(test_summary['name'], test_summary['p_value']))

        return {
            "gene1_coef": str(format(float(Gene1_coef),'.2E')),
            "gene1_p_val":str(format(float(Gene1_p_val),'.2E')),
            "gene2_coef": str(format(float(Gene2_coef),'.2E')),
            "gene2_p_val": str(format(float(Gene2_p_val),'.2E')),
        }

    def cox_img(self, df, sur, gene1, gene2, drop_image_columns, cancer_type):
        drop_image_columns += ['Hybridization REF']

        gene1_name = gene1
        gene2_name = gene2
        if '|' in gene1:
            gene1_name = gene1.split('|')[0]
        elif ',' in gene1:
            gene1_name = gene1.split(',')[0]
        if '|' in gene2:
            gene2_name = gene2.split('|')[0]
        elif ',' in gene2:
            gene2_name = gene2.split(',')[0]
        df.rename(columns={'years_to_birth': 'Age at diagnosis', 'pathologic_stage': 'Stage', 'gender': 'Sex',
                           'Gene1': gene1_name, 'Gene2':gene2_name}, inplace=True)

        df.drop(drop_image_columns, axis=1, inplace=True)
        cox = CoxPHFitter()
        cox.fit(df, duration_col='days_'+sur, event_col=sur+'_status')
        cox.plot()
        summary_df = cox.summary

        n = str(df.shape[0])

        # 轉成圖片的步驟
        sio = BytesIO()

        #plt.title(gene1_name + ' & ' + gene2_name + ' (n='+n+')')
        plt.xlabel("log (Hazard Ratio) (95% CI)")
        plt.title(cancer_type+', Hazard Ratio Plot' + ' (' + sur + ', ' + 'n=' + n + ')')
        plt.savefig(sio, format='png', dpi=300, bbox_inches='tight')
        data = base64.encodebytes(sio.getvalue()).decode()

        html = '''
            <img class="aftImg" src="data:image/png;base64,{}" />
        '''.format(data)
        plt.close()

        results = proportional_hazard_test(cox, df, time_transform='rank')
        #results.print_summary(decimals=3)
        test_summary = results.__dict__
        # test_dic = dict(zip(test_summary['name'], test_summary['p_value']))
        test_summary = json.loads(json.dumps(test_summary, cls = py.utils.PlotlyJSONEncoder))

        # format and replace value
        tmp_df = summary_df.to_dict('index')
        for key, value in tmp_df.items():
            value["p"] = format(value["p"], ".2E")
            tmp_df[key] = value

        return [html, tmp_df, test_summary]

    def aft(self, df, sur):

        df.drop(['Hybridization REF'], axis=1, inplace=True)

        aft = LogNormalAFTFitter()

        aft.fit(df, duration_col='days_' + sur, event_col=sur + '_status')

        summary_df = aft.summary

        #print(type(summary_df))

        # birth_coef = str(round(float(summary_df.loc[('years_to_birth')]['coef']), 3))
        # birth_p_val = str(round(float(summary_df.loc[('years_to_birth')]['p']), 3))
        # gender_coef = str(round(float(summary_df.loc[('gender')]['coef']), 3))
        # gender_p_val = str(round(float(summary_df.loc[('gender')]['p']), 3))
        # stage_coef = str(round(float(summary_df.loc[('pathologic_stage')]['coef']), 3))
        # stage_p_val = str(round(float(summary_df.loc[('pathologic_stage')]['p']), 3))
        Gene1_coef = self.format_aft_val(summary_df, 'mu_', 'Gene1', 'coef')
        Gene1_p_val = self.format_aft_val(summary_df, 'mu_', 'Gene1', 'p')
        Gene2_coef = self.format_aft_val(summary_df, 'mu_', 'Gene2', 'coef')
        Gene2_p_val = self.format_aft_val(summary_df, 'mu_', 'Gene2', 'p')

        # result_exp_p_val = str(round(float(result_df.loc[('expression')]['p']), 3))
        # print(result_exp_p_val)

        return {
            "gene1_coef": Gene1_coef,
            "gene1_p_val":Gene1_p_val,
            "gene2_coef": Gene2_coef,
            "gene2_p_val":Gene2_p_val,
        }

    def aft_img(self, df, sur, gene1, gene2, drop_image_columns, cancer_type):
        drop_image_columns += ['Hybridization REF']
        
        gene1_name = gene1
        gene2_name = gene2
        if '|' in gene1:
            gene1_name = gene1.split('|')[0]
        elif ',' in gene1:
            gene1_name = gene1.split(',')[0]
        if '|' in gene2:
            gene2_name = gene2.split('|')[0]
        elif ',' in gene2:
            gene2_name = gene2.split(',')[0]
        n = str(df.shape[0])
        df.rename(columns={'years_to_birth': 'Age at diagnosis', 'pathologic_stage': 'Stage', 'gender': 'Sex',
                           'Gene1': gene1_name, 'Gene2': gene2_name}, inplace=True)

        df.drop(drop_image_columns, axis=1, inplace=True)

        aft = LogNormalAFTFitter()
        aft.fit(df, duration_col='days_' + sur, event_col=sur + '_status')
        aft.plot()
        summary_df = aft.summary

        # 轉成圖片的步驟
        sio = BytesIO()

        #plt.title(gene1_name + ' & ' + gene2_name + ' (n='+n+')')
        plt.xlabel("log (Time Ratio) (95% CI)")
        plt.title(cancer_type+', Time Ratio Plot' + '(' + sur + ', ' + 'n=' + n + ')')
        plt.savefig(sio, format='png', dpi=150, bbox_inches='tight')
        data = base64.encodebytes(sio.getvalue()).decode()

        html = '''
            <img class="aftImg" src="data:image/png;base64,{}" />
        '''.format(data)
        plt.close()

        # format and replace value
        tmp_df = summary_df.to_dict('index')
        tmps = {}
        for key, value in tmp_df.items():
            value["p"] = format(value["p"], ".2E")
            tmps[key[1]] = value

        return [html, tmps]

    def transform1(self, df, num):
        ex = df['Gene1']
        ex = pd.to_numeric(ex)
        newex = ex.rank(method='first').tolist()

        for x in range(len(newex)):
            df.iat[x, num-2] = norm.ppf((newex[x] - 0.5) / len(newex))
        return df

    def transform2(self, df, num):
        ex = df['Gene2']
        ex = pd.to_numeric(ex)
        newex = ex.rank(method='first').tolist()

        for x in range(len(newex)):
            df.iat[x, -1] = norm.ppf((newex[x] - 0.5) / len(newex))
        return df

    def format_val(self, data, a, b):
        val = ""

        try:
            val = data.loc[a, b]
            val = float(val)
            if val != 0 :
                val = format(val, ".1E")

        except Exception as e:
            print(e)

        return val

    def format_aft_val(self, data, a, b, c):
        val = ""

        try:
            val = data.loc[(a, b)][c]
            val = float(val)
            if val != 0 :
                val = format(val, ".1E")

        except Exception as e:
            print(e)

        return val

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

    def get_cox_data(self, category1, category2, gene1, gene2, cancer_type):
        res = []
        modes = ['OS','DFI','PFI','DSS']
        for mode in modes:
            
            full_name = 'Overall'
            if mode == 'OS':
                full_name = 'Overall'
            elif mode == 'DFI':
                full_name = 'Disease-Free'
            elif mode == 'PFI':
                full_name = 'Progression-Free'
            elif mode == 'DSS':
                full_name = 'Disease-Specific'

            try:
                target_path = self.path + "Cox_parsedata" + os.sep + mode + "_parsedata" + os.sep
                
                cox_path = self.get_cox_path(target_path, cancer_type + "output.txt")

                clinical_info = pd.read_csv(cox_path, sep='\t')

                g1_exp_df = self.get_exp_df(cancer_type, category1, gene1)
                g2_exp_df = self.get_exp_df(cancer_type, category2, gene2)
                
                # jand 請把取gene name col name 分開判斷= =
                index1 = "MetaFeature"
                index2 = "MetaFeature"
                if category1 == "lncrna":
                    index1 = "gene_symbol"
                if category2 == "lncrna":
                    index2 = "gene_symbol"

                new_df = self.get_exp1(clinical_info, g1_exp_df[g1_exp_df[index1] == gene1])
                new_df = self.get_exp2(new_df, g2_exp_df[g2_exp_df[index2] == gene2])

                new_df = self.drop_nan(new_df)
                num = new_df.shape[1]
                new_df = self.transform1(new_df, num)
                new_df = self.transform2(new_df, num)

                tmps = self.cox(new_df, mode)

                res.append({
                    "survival_type": full_name,
                    "patients": new_df.shape[0],
                    "gene1_coef": tmps["gene1_coef"],
                    "gene1_p_val": tmps["gene1_p_val"],
                    "gene2_coef": tmps["gene2_coef"],
                    "gene2_p_val": tmps["gene2_p_val"]
                })
            except Exception as e:
                print(str(e))

                res.append({
                    "survival_type": full_name,
                    "patients": "",
                    "gene1_coef": "",
                    "gene1_p_val": "",
                    "gene2_coef": "",
                    "gene2_p_val": "",
                    "message": str(e)
                })

        return res

    def get_cox_img(self, mode, category1, category2, gene1, gene2, cancer_type, drop_image_columns):
        print(mode, category1, category2, gene1, gene2, cancer_type, drop_image_columns)
        cox_data = []
        try:
            target_path = self.path + "Cox_parsedata" + os.sep + mode + "_parsedata" + os.sep
        
            cox_path = self.get_cox_path(target_path, cancer_type + "output.txt")

            clinical_info = pd.read_csv(cox_path, sep='\t')

            g1_exp_df = self.get_exp_df(cancer_type, category1, gene1)
            g2_exp_df = self.get_exp_df(cancer_type, category2, gene2)

            # jand 請把取gene name col name 分開判斷= =
            index1 = "MetaFeature"
            index2 = "MetaFeature"
            if category1 == "lncrna":
                index1 = "gene_symbol"
            if category2 == "lncrna":
                index2 = "gene_symbol"

            new_df = self.get_exp1(clinical_info, g1_exp_df[g1_exp_df[index1] == gene1])
            new_df = self.get_exp2(new_df, g2_exp_df[g2_exp_df[index2] == gene2])
            # print(new_df)
            new_df = self.drop_nan(new_df)
            num = new_df.shape[1]
            new_df = self.transform1(new_df, num)
            new_df = self.transform2(new_df, num)
            # print(new_df)
            cox_data = self.cox_img(new_df, mode, gene1, gene2, drop_image_columns, cancer_type)
        except Exception as e:
            print(str(e))

        return cox_data

    def get_cox_upload_img(self, mode, category1, category2, gene1, gene2, cancer_type, upload_file):
        
        cox_data = []
        try:
            clinical_info = pd.read_csv(upload_file, delimiter=',')

            # drop what the extra added columns
            df_len = len(clinical_info.columns)
            if df_len < 21:
                raise Exception("File columns lack of some titles")
            drop_indexes = []
            for i in range(df_len - 20, df_len):
                drop_indexes.append(i)
            clinical_info.drop(clinical_info.columns[drop_indexes],axis=1,inplace=True)

            g1_exp_df = self.get_exp_df(cancer_type, category1, gene1)
            g2_exp_df = self.get_exp_df(cancer_type, category2, gene2)

            # jand 請把取gene name col name 分開判斷= =
            index1 = "MetaFeature"
            index2 = "MetaFeature"
            if category1 == "lncrna":
                index1 = "gene_symbol"
            if category2 == "lncrna":
                index2 = "gene_symbol"

            new_df = self.get_exp1(clinical_info, g1_exp_df[g1_exp_df[index1] == gene1])
            new_df = self.get_exp2(new_df, g2_exp_df[g2_exp_df[index2] == gene2])

            new_df = self.drop_nan(new_df)
            num = new_df.shape[1]
            new_df = self.transform1(new_df, num)
            new_df = self.transform2(new_df, num)

            if np.std(new_df['pathologic_stage']) == 0.0 :
                new_df.drop(['pathologic_stage'], axis=1, inplace=True)
            if np.std(new_df['gender']) == 0.0 :
                new_df.drop(['gender'], axis=1, inplace=True)
            cox_data = self.cox_img(new_df, mode, gene1, gene2, [], cancer_type)
        except Exception as e:
            raise Exception('The uploaded file must have all the features (columns) downloaded from the same webpage.')
            print(str(e))

        return cox_data

    def get_cox_download_data(self, mode, category1, category2, gene1, gene2, cancer_type):
        
        try:
            target_path = self.path + "Cox_parsedata" + os.sep + mode + "_parsedata" + os.sep
        
            cox_path = self.get_cox_path(target_path, cancer_type + "output.txt")

            clinical_info = pd.read_csv(cox_path, sep='\t')

            g1_exp_df = self.get_exp_df(cancer_type, category1, gene1)
            g2_exp_df = self.get_exp_df(cancer_type, category2, gene2)
            # jand 請把取gene name col name 分開判斷= =
            index1 = "MetaFeature"
            index2 = "MetaFeature"
            if category1 == "lncrna":
                index1 = "gene_symbol"
            if category2 == "lncrna":
                index2 = "gene_symbol"

            new_df = self.get_exp1(clinical_info, g1_exp_df[g1_exp_df[index1] == gene1])
            new_df = self.get_exp2(new_df, g2_exp_df[g2_exp_df[index2] == gene2])

            new_df = self.drop_nan(new_df)
            num = new_df.shape[1]
            new_df = self.transform1(new_df, num)
            new_df = self.transform2(new_df, num)

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
            print(str(e))

        return ""

    def get_aft_data(self, category1, category2, gene1, gene2, cancer_type):
        res = []
        modes = ['OS','DFI','PFI','DSS']
        for mode in modes:
            
            full_name = 'Overall'
            if mode =='OS':
                full_name = 'Overall'
            elif mode=='DFI':
                full_name = 'Disease-Free'
            elif mode=='PFI':
                full_name = 'Progression-Free'
            elif mode=='DSS':
                full_name = 'Disease-Specific'
                
            try:
                target_path = self.path + "Cox_parsedata" + os.sep + mode + "_parsedata" + os.sep
        
                cox_path = self.get_cox_path(target_path, cancer_type + "output.txt")

                clinical_info = pd.read_csv(cox_path, sep='\t')

                g1_exp_df = self.get_exp_df(cancer_type, category1, gene1)
                g2_exp_df = self.get_exp_df(cancer_type, category2, gene2)

                # jand 請把取gene name col name 分開判斷= =
                index1 = "MetaFeature"
                index2 = "MetaFeature"
                if category1 == "lncrna":
                    index1 = "gene_symbol"
                if category2 == "lncrna":
                    index2 = "gene_symbol"

                new_df = self.get_exp1(clinical_info, g1_exp_df[g1_exp_df[index1] == gene1])
                new_df = self.get_exp2(new_df, g2_exp_df[g2_exp_df[index2] == gene2])

                new_df = self.drop_nan(new_df)
                num = new_df.shape[1]
                new_df = self.transform1(new_df, num)
                new_df = self.transform2(new_df, num)

                tmps = self.aft(new_df, mode)

                res.append({
                    "survival_type": full_name,
                    "patients": new_df.shape[0],
                    "gene1_coef": tmps["gene1_coef"],
                    "gene1_p_val": tmps["gene1_p_val"],
                    "gene2_coef": tmps["gene2_coef"],
                    "gene2_p_val": tmps["gene2_p_val"]
                })
            except Exception as e:
                print(str(e))

                res.append({
                    "survival_type": full_name,
                    "patients": "",
                    "gene1_coef": "",
                    "gene1_p_val": "",
                    "gene2_coef": "",
                    "gene2_p_val": "",
                    "message": str(e)
                })

        return res

    def get_aft_img(self, mode, category1, category2, gene1, gene2, cancer_type, drop_image_columns):
        
        aft_data = []
        try:
            target_path = self.path + "Cox_parsedata" + os.sep + mode + "_parsedata" + os.sep
        
            cox_path = self.get_cox_path(target_path, cancer_type + "output.txt")

            clinical_info = pd.read_csv(cox_path, sep='\t')

            g1_exp_df = self.get_exp_df(cancer_type, category1, gene1)
            g2_exp_df = self.get_exp_df(cancer_type, category2, gene2)

            # jand 請把取gene name col name 分開判斷= =
            index1 = "MetaFeature"
            index2 = "MetaFeature"
            if category1 == "lncrna":
                index1 = "gene_symbol"
            if category2 == "lncrna":
                index2 = "gene_symbol"

            new_df = self.get_exp1(clinical_info, g1_exp_df[g1_exp_df[index1] == gene1])
            new_df = self.get_exp2(new_df, g2_exp_df[g2_exp_df[index2] == gene2])

            new_df = self.drop_nan(new_df)
            num = new_df.shape[1]
            new_df = self.transform1(new_df, num)
            new_df = self.transform2(new_df, num)

            aft_data = self.aft_img(new_df, mode, gene1, gene2, drop_image_columns, cancer_type)
        except Exception as e:
            print(str(e))

        return aft_data

    def get_aft_upload_img(self, mode, category1, category2, gene1, gene2, cancer_type, upload_file):
        
        aft_data = []
        try:
            clinical_info = pd.read_csv(upload_file, delimiter=',')
            clinical_info.to_csv(index=False)

            # drop what the extra added columns
            df_len = len(clinical_info.columns)
            if df_len < 21:
                raise Exception("File columns lack of some titles")
            drop_indexes = []
            for i in range(df_len - 20, df_len):
                drop_indexes.append(i)
            clinical_info.drop(clinical_info.columns[drop_indexes],axis=1,inplace=True)

            g1_exp_df = self.get_exp_df(cancer_type, category1, gene1)
            g2_exp_df = self.get_exp_df(cancer_type, category2, gene2)

            # jand 請把取gene name col name 分開判斷= =
            index1 = "MetaFeature"
            index2 = "MetaFeature"
            if category1 == "lncrna":
                index1 = "gene_symbol"
            if category2 == "lncrna":
                index2 = "gene_symbol"

            new_df = self.get_exp1(clinical_info, g1_exp_df[g1_exp_df[index1] == gene1])
            new_df = self.get_exp2(new_df, g2_exp_df[g2_exp_df[index2] == gene2])

            new_df = self.drop_nan(new_df)
            num = new_df.shape[1]
            new_df = self.transform1(new_df, num)
            new_df = self.transform2(new_df, num)

            if np.std(new_df['pathologic_stage']) == 0.0 :
                new_df.drop(['pathologic_stage'], axis=1, inplace=True)
            if np.std(new_df['gender']) == 0.0 :
                new_df.drop(['gender'], axis=1, inplace=True)

            aft_data = self.aft_img(new_df, mode, gene1, gene2, [], cancer_type)
        except Exception as e:
            print(str(e))

        return aft_data

    def get_aft_download_data(self, mode, category1, category2, gene1, gene2, cancer_type):
        
        try:
            target_path = self.path + "Cox_parsedata" + os.sep + mode + "_parsedata" + os.sep
        
            cox_path = self.get_cox_path(target_path, cancer_type + "output.txt")

            clinical_info = pd.read_csv(cox_path, sep='\t')

            g1_exp_df = self.get_exp_df(cancer_type, category1, gene1)
            g2_exp_df = self.get_exp_df(cancer_type, category2, gene2)

            # jand 請把取gene name col name 分開判斷= =
            index1 = "MetaFeature"
            index2 = "MetaFeature"
            if category1 == "lncrna":
                index1 = "gene_symbol"
            if category2 == "lncrna":
                index2 = "gene_symbol"

            new_df = self.get_exp1(clinical_info, g1_exp_df[g1_exp_df[index1] == gene1])
            new_df = self.get_exp2(new_df, g2_exp_df[g2_exp_df[index2] == gene2])

            new_df = self.drop_nan(new_df)
            num = new_df.shape[1]
            new_df = self.transform1(new_df, num)
            new_df = self.transform2(new_df, num)

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
            print(str(e))

        return ""

    