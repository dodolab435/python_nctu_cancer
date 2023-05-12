
from scipy.stats import norm
from scipy.stats import spearmanr
from scipy.stats import pearsonr
from os import listdir
from io import BytesIO
from matplotlib import pyplot as plt
from lifelines.statistics import proportional_hazard_test
from lifelines import LogNormalAFTFitter
from lifelines import WeibullAFTFitter
from lifelines import CoxPHFitter
from lifelines.statistics import logrank_test
from lifelines import KaplanMeierFitter
from python_nctu_cancer.settings import CUSTOM_SETTINGS
import plotly as py
import pymongo
import os
import json
import math
import base64
import matplotlib as plt
import statistics
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
from multiprocessing.managers import ValueProxy
import sys
import traceback
import matplotlib
matplotlib.use('AGG')


class NewAft:
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

    def get_genome_by_metafeature(self, category, type, meta_feature, cgcite=""):
        mongo_db = self.mongodb_conn
        cur_coll = mongo_db[f"cancer_genome_{category.lower()}"]

        myquery = {}
        myquery["type"] = type
        # myquery["MetaFeature"] = {
        #     "$regex": f"(^{meta_feature}([;|,]))|^({meta_feature})$"}
        myquery["MetaFeature"] = meta_feature
        
        if cgcite != "":
            myquery["Cgcite"] = cgcite

        exclude_fields = {'_id': False, 'category': False,
                          'type': False, 'MetaFeature': False}
        return cur_coll.find(myquery, exclude_fields)

    def drop_nan(self, df1, gene):
        df1 = df1.dropna(subset=[gene])
        df1 = df1[df1[gene] != 'NA']
        df1 = df1[df1[gene] != 'NaN']
        df1 = df1[df1[gene] != 'nan']
        df1 = df1[df1[gene] != '']
        return df1

    def database_df_preproc(self, df, gene, drop_image_columns):
        df.rename(columns={'years_to_birth': 'Age at diagnosis',
                  'pathologic_stage': 'Stage', 'gender': 'Sex', 'Expression': gene}, inplace=True)
        df = self.drop_nan(df, gene)
        df.drop(drop_image_columns, axis=1, inplace=True)
        return df
    
    def aft_cox_img(self, tab, df, duration_col, event_col, plt_title):
        if tab == "cox":
            fitter = CoxPHFitter()
        else:
            fitter = LogNormalAFTFitter()

        fitter.fit(df, duration_col=duration_col,
                event_col=event_col)
        fitter.plot()
        summary_df = fitter.summary

        # 轉成圖片的步驟
        sio = BytesIO()

        #plt.title(gene+' (n='+n+')')
        plt.xlabel("log (Hazard Ratio) (95% CI)")
        plt.title(plt_title)
        plt.savefig(sio, format='png', dpi=300, bbox_inches='tight')
        data = base64.encodebytes(sio.getvalue()).decode()

        html = '''
            <img class="aftImg" src="data:image/png;base64,{}" />
        '''.format(data)
        plt.close()

        tmp_df = summary_df.to_dict('index')
        for key, value in tmp_df.items():
            value["p"] = format(value["p"], ".2E")
            value["coef"] = format(value["coef"], ".2E")
            for k in ["exp(coef)", "exp(coef) lower 95%", "exp(coef) upper 95%"]:
                if math.isinf(float(value[k])):
                    value[k] = str(value[k])
                elif value[k] >= 100:
                    value[k] = format(value[k], ".2E")
                else:
                    value[k] = format(value[k], ".2f")
        
        if tab == "cox":
            # PH assumption
            results = proportional_hazard_test(fitter, df, time_transform='rank')
            # results.print_summary(decimals=3)
            test_summary = results.__dict__
            test_summary = json.loads(json.dumps(test_summary, cls=py.utils.PlotlyJSONEncoder))
            return [html, tmp_df, test_summary]
        else:
            return [html, tmp_df]
    
    def get_patient(self, cancer_type, dic, survival_type, meta_feature):
        # 取得指定存在檔案路徑
        target_path = self.path + "Cox_parsedata" + os.sep
        target_path += survival_type.upper() + "_parsedata" + os.sep
        cox_path = self.get_cox_path(target_path, cancer_type + "output.txt")
        
        if cox_path is None:
            raise Exception("No results for the selected item.")
        
        # 依照不同類別呈現不同
        x_value = 0
        y_value = 0
        if cancer_type == "BLCA":
            x_value = 6
            y_value = 6
        elif "All_feature" in cox_path:
            x_value = 6
            y_value = 6
        elif "without_gender" in cox_path:
            x_value = 5
            y_value = 5
        elif "without_stage" in cox_path:
            x_value = 5
            y_value = 5
        elif "group4" in cox_path:
            x_value = 4
            y_value = 4

        df1 = pd.read_csv(cox_path, sep='\t')
        df1['Expression'] = 'NA'

        dfx = df1['Hybridization REF']
        # print(x_value, y_value, unnamed_value)
        # print(df1)
        for x in dic.keys():
            for y in range(len(dfx)):
                if x[:12].lower() == dfx[y]:
                    df1.iat[y, y_value] = float(dic[x])

        # if unnamed_value > 0:
        #     df1.drop(['Unnamed: ' + str(unnamed_value)], axis=1, inplace=True)

        temp = []
        for x in range(len(df1['Expression'])):
            list1 = df1.loc[x].tolist()
            if 'NA' in list1:
                temp.append(x)
        df1.drop(df1.index[np.array(temp)], inplace=True)

        if df1.empty:
            raise Exception("DataFrame is empty")

        ex = df1['Expression']
        ex = pd.to_numeric(ex)
        newex = ex.rank(method='first').tolist()

        for x in range(len(newex)):
            df1.iat[x, x_value] = norm.ppf((newex[x] - 0.5) / len(newex))

        #df1.drop(['Hybridization REF'], axis=1, inplace=True)
        df1.rename(columns={'Hybridization REF': 'Patient ID'}, inplace=True)
        df1.rename(columns={'Expression': meta_feature}, inplace=True)
        df1.to_csv(index=False)
        return df1

    def count(self, cancer_type, dic, survival_type):
        # 取得指定存在檔案路徑
        target_path = self.path + "Cox_parsedata" + os.sep
        target_path += survival_type.upper() + "_parsedata" + os.sep
        cox_path = self.get_cox_path(target_path, cancer_type + "output.txt")
        
        if cox_path is None:
            raise Exception("No results for the selected item.")
        
        # 依照不同類別呈現不同
        x_value = 0
        y_value = 0
        if cancer_type == "BLCA":
            x_value = 6
            y_value = 6
        elif "All_feature" in cox_path:
            x_value = 6
            y_value = 6
        elif "without_gender" in cox_path:
            x_value = 5
            y_value = 5
        elif "without_stage" in cox_path:
            x_value = 5
            y_value = 5
        elif "group4" in cox_path:
            x_value = 4
            y_value = 4

        df1 = pd.read_csv(cox_path, sep='\t')
        df1['Expression'] = 'NA'

        dfx = df1['Hybridization REF']
        # print(x_value, y_value, unnamed_value)
        # print(df1)
        for x in dic.keys():
            for y in range(len(dfx)):
                if x[:12].lower() == dfx[y]:
                    df1.iat[y, y_value] = float(dic[x])

        # if unnamed_value > 0:
        #     df1.drop(['Unnamed: ' + str(unnamed_value)], axis=1, inplace=True)

        temp = []
        for x in range(len(df1['Expression'])):
            list1 = df1.loc[x].tolist()
            if 'NA' in list1:
                temp.append(x)
        df1.drop(df1.index[np.array(temp)], inplace=True)

        if df1.empty:
            raise Exception("DataFrame is empty")

        ex = df1['Expression']
        ex = pd.to_numeric(ex)
        newex = ex.rank(method='first').tolist()

        for x in range(len(newex)):
            df1.iat[x, x_value] = norm.ppf((newex[x]-0.5)/len(newex))

        df1.drop(['Hybridization REF'], axis=1, inplace=True)
        df1.to_csv(index=False)
        return df1

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

    def get_download_data(self, category, cancer_type, meta_feature, cgcite, survival_type):
        list_genome = self.get_genome_by_metafeature(
            category, cancer_type, meta_feature, cgcite)
        list_columns = []
        list_values = []
        for group_dataset in list_genome:
            for col in group_dataset:
                if col.lower() in ["cgcite", "type"]:
                    continue
                try:
                    list_values.append(float(group_dataset[col]))
                    list_columns.append(col)
                except Exception as err:
                    print(err)
            break

        dic = dict(zip(list_columns, list_values))

        df1 = self.get_patient(cancer_type, dic, survival_type, meta_feature)

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
        for row in df1.iterrows():
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
            df1[d] = append_data[d]

        return df1

    def get_gene(self, metafeature):
        cur_coll = self.mongodb_conn["cancer_genome_lncrna"]
        myquery = {"type": 'BLCA', "MetaFeature": metafeature}
        exclude_fields = {"category": False, "type": False, "Cgcite": False}
        df = pd.DataFrame(cur_coll.find(myquery, exclude_fields))
        a = df['MetaFeature'].tolist()
        b = df['gene_symbol'].tolist()
        dic = dict(zip(a, b))
        return dic[metafeature]

    def get_database_data(self, category, cancer_type, meta_feature, cgcite, survival_type, drop_image_columns):
        list_genome = self.get_genome_by_metafeature(category, cancer_type, meta_feature, cgcite)
        list_columns = []
        list_values = []
        for group_dataset in list_genome:
            for col in group_dataset:
                if col.lower() in ["cgcite", "type"]:
                    continue
                try:
                    list_values.append(float(group_dataset[col]))
                    list_columns.append(col)
                except Exception as err:
                    print(err)
            break

        dic = dict(zip(list_columns, list_values))

        df1 = self.count(cancer_type, dic, survival_type)

        gene = meta_feature
        if category == 'lncrna':
            gene = self.get_gene(gene)
        if gene.find("|") != -1:
            gene = gene.split("|")[0]
        elif gene.find(",") != -1:
            gene = gene.split(",")[0]
        elif gene.find(";") != -1:
            gene = gene.split(";")[0]
        elif 'methylation' in category:
            gene = cgcite
        
        df1 = self.database_df_preproc(df1, gene, drop_image_columns)
        
        return df1
    
    def get_aft_cox_img_data(self, tab, category, cancer_type, meta_feature, cgcite, survival_type, drop_image_columns):
        df1 = self.get_database_data(category, cancer_type, meta_feature, cgcite, survival_type, drop_image_columns)
        
        n = str(df1.shape[0])
        if cancer_type != 'None':
            plt_title = cancer_type + ', Time Ratio Plot ' + '(' + survival_type + ', ' + 'n=' + n + ')'
        else:
            plt_title = 'Time Ratio Plot ' + '(' + survival_type + ', ' + 'n=' + n + ')'

        aft_cox_data = self.aft_cox_img(tab, df1, 'days_' + survival_type.upper(),survival_type.upper() + '_status', plt_title)
        return aft_cox_data
        
        
    def format_val(self, data, a, b):
        val = ""

        try:
            val = data.loc[a, b]
            val = float(val)
            if val != 0:
                val = format(val, ".2E")

        except Exception as e:
            print(e)

        return val

    def test(self, type, category, gene):
        mongo_col = self.mongodb_conn["cancer_genome_" + category]
        myquery = {
            'type': type
        }
        if category == "lncrna":
            myquery["gene_symbol"] = gene
        else:
            # myquery["MetaFeature"] = gene
            myquery["MetaFeature"] = {"$regex": f"(^{gene}([;|,]))|^({gene})$"}
            # myquery["MetaFeature"] = {
            #         "$regex": f"(^{gene}(;|\\|))|^({gene})$|(;[\s]*{gene}$)"}

        data = list(mongo_col.find(
            myquery, {'_id': False, 'category': False, 'type': False}))

        json_data = {}
        list_name = []
        # Forcing change MetaFeature value
        for i, d in enumerate(data):
            print(data[i]["MetaFeature"])
            list_name.append(data[i]["MetaFeature"])
            # break
            # for k in data[i]:
            #     # if k not in ["MetaFeature"]:
            #     #     continue
            #     val = data[i][k]
            #     # if val.find("|") != -1:
            #     #     val = val.split("|")[0]
            #     # elif val.find(",") != -1:
            #     #     val = val.split(",")[0]
            #     data[i][k] = val

        # data2 = pd.DataFrame(data).to_json()
        return list_name
