from lifelines.statistics import logrank_test
from plotly.graph_objs import Data
from python_nctu_cancer.settings import CUSTOM_SETTINGS
import pymongo
import json
import base64
import os
import plotly.graph_objects as go
import plotly as py
import math
import statistics
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
from lifelines import KaplanMeierFitter
import matplotlib

matplotlib.use('AGG')

const_layout = {
    "title": "DNA overall survival",
    "legend": {
        "tracegroupgap": 0,
        "x": 1.05,
        "y": 1
    },
    "xaxis1": {
        "title": 'Survival Time (Months)',
        "anchor": "y1",
        "tickformat": ".1f",
    },
    "yaxis1": {
        "title": 'Probability of survival',
        "anchor": "x1",
        "range": [
            0,
            1
        ],
    },
    "yaxis2": {
        "title": 'Number of patients',
        "anchor": "x2",
        "range": [
            0,
            1
        ],
    },
    "titlefont": {
        "size": 12,
        "color": "#000000"
    },
    "grid": {
        "rows": 2, 
        "columns": 1, 
        "subplots":[['xy2'],['xy']],
        "roworder":'bottom to top',
    }
}
# 這個是圖片上黑色marker，也要可以修改顏色和大小
trace_black = {
    "mode": "markers",
    "name": "Censors",
    "text": None,
    "type": "scatter",
    "xaxis": "x1",
    "yaxis": "y1",
    "marker_line_width": 3,
    "marker": {
        "size": 15,
        "color": "black",
        "symbol": "line-ns-open",
        "opacity": 1,
        "sizeref": 1,
        "sizemode": "area"
    },
    "showlegend": False
}
trace_blue = {
    "mode": "markers",
    "name": "Censors",
    "text": None,
    "type": "scatter",
    "xaxis": "x1",
    "yaxis": "y1",
    # "marker_line_width" : 2,
    "marker": {
        "size": 15,
        "color": "blue",
        "symbol": "line-ns-open",
        "opacity": 1,
        "sizeref": 1,
        "sizemode": "area"
    },
    "showlegend": False
}
current_series = {
    "line": {
        "dash": "solid",
        "shape": "hv",
    },
    "xaxis": 'x',
    "yaxis": 'y',
    "mode": "lines",
}


class Kmplotter:

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

    def get_genome(self, category, cancer_type, meta_feature):
        cur_coll = self.mongodb_conn["cancer_genome_" + category.lower()]
        myquery = {"type": cancer_type}
        if "methylation" in category:
            myquery["Cgcite"] = meta_feature
        elif "lncrna" == category and meta_feature[:4] != "ENSG":
            myquery["gene_symbol"] = meta_feature
        else:
            myquery["MetaFeature"] = meta_feature
        exclude_fields = {"category": False, "type": False, "Cgcite": False}
        return cur_coll.find(myquery, exclude_fields)

    def get_survival_data(self, cancer_type):
        path = os.path.abspath(os.path.dirname(__name__)) + os.sep + "python_nctu_cancer" + os.sep
        excel_df = pd.read_excel(path + 'Supplemental/TCGA-CDR-SupplementalTableS1.xlsx')
        
        survival_data = excel_df.loc[excel_df['type'] == cancer_type]
        survival_data = survival_data[[
                                        'bcr_patient_barcode', 
                                        'type', 
                                        'OS',
                                        'OS.time', 
                                        'DSS', 
                                        'DSS.time', 
                                        'DFI', 
                                        'DFI.time', 
                                        'PFI', 
                                        'PFI.time'
                                       ]]

        return survival_data

    def get_exp(self, df1, df2, exp_col="Expression"):
        temp = df1['bcr_patient_barcode'].tolist()
        exp = df2.iloc[0].tolist()

        a = list(df2.columns.values)
        a = [i[:12] for i in a]
        dic1 = dict(zip(a, exp))

        templist = []
        for x in temp:
            if x in dic1:
                templist.append(dic1[x])
            else:
                templist.append(float('nan'))

        df1[exp_col] = templist

        return df1

    # 將NA資料排除
    def drop_nan(self, df, drop_nan_col_list=None):
        if drop_nan_col_list is None:
            drop_nan_col_list = list(df.columns)
        
        for drop_col in drop_nan_col_list:
            df = df.dropna(subset=[drop_col])
            df = df[df[drop_col] != 'NA']
            df = df[df[drop_col] != 'NaN']
        df = df[drop_nan_col_list]
        return df

    def follow_up_threshold(self, df, status_col, day_col, time):
        limit = 1096
        if int(time) == 3:
            limit = 1096
        elif int(time) == 5:
            limit = 1826
        elif int(time) == 10:
            limit = 3653

        list1 = df[day_col].tolist()
        list2 = df[status_col].tolist()

        temp_mode = []
        temp_time = []
        for x in range(len(list1)):
            if float(list1[x]) > limit:
                if list2[x] > 0:
                    temp_mode.append(float('0'))
                else:
                    temp_mode.append(list2[x])
                temp_time.append(limit)
            else:
                temp_mode.append(list2[x])
                temp_time.append(list1[x])
        df[status_col] = temp_mode
        df[day_col] = temp_time
        return df

    # 表現量分群
    def seperate_group(self, df, exp_col, status_col, day_col, group_col="groups", time=0, L_per=50, H_per=50):
        df[[exp_col, status_col, day_col]] = df[[exp_col, status_col, day_col]].apply(pd.to_numeric)
        
        time = int(time)
        L_per = int(L_per)
        H_per = int(H_per)
        
        if L_per < 1:
            L_per = 1
        if L_per > 99:
            L_per = 99
        if H_per < 1:
            H_per = 1
        if H_per > 99:
            H_per = 99
        # 要先確定原本patient人數有超過一百個才可以讓使用者輸入，否則拒絕輸入  if df.shape[0] > 100:
        df = df.sort_values(by=[exp_col])
        nH = (df.shape[0]*(H_per/100))
        nL = (df.shape[0]*(L_per/100))
        # cutoff 判斷
        if H_per + L_per == 100:
            nH = min(df.shape[0]-1, math.ceil(nH))
            nL = max(1, math.floor(nL))
        elif H_per + L_per < 100:
            nH = max(1, round(nH))
            nL = max(1, round(nL))
        else:
            # 如果 L_per + H_per > 100 以最大的當基準填滿100
            if max(nH, nL) == nL:
                nH = df.shape[0] - nL
            else:
                nL = df.shape[0] - nH
                
        df1 = pd.DataFrame(df.iloc[-int(nH):])
        df1[group_col] = 'H'
        df2 = pd.DataFrame(df.iloc[0:int(nL)])
        df2[group_col] = 'L'
        df = pd.concat([df1, df2], axis=0, ignore_index=True)
        
        #if是指default的狀態和else是使用者輸入後
        
        if time == 0:
            return df
        else:
            df = self.follow_up_threshold(df, status_col, day_col, time)
            return df

    def log_rank(self, df, status_col, day_col, group_col="groups"):
        date_df = df[day_col]
        event_df = df[status_col]

        group = df[group_col]
        u = pd.unique(group)
        if len(u) != 2:
            raise "group num not 2"
        i1 = (group == u[0])
        i2 = (group == u[1])
        results = logrank_test(date_df[i1], date_df[i2], event_observed_A=event_df[i1], event_observed_B=event_df[i2])
        return str(results.p_value)

    def drawkmplot(self, df, status_col, day_col, groups_col):
        date = df[day_col]
        event = df[status_col]
        group_unique_list = np.unique(df[groups_col])

        y2_range = 1
        chart_series = []
        for i in range(2):
            group_filter = (df[groups_col] == group_unique_list[i])
            paramSize = sum(group_filter)

            kmf = KaplanMeierFitter()
            kmf.fit(date[group_filter], event[group_filter], label=group_unique_list[i])
            
            plx = kmf.survival_function_.index.values.tolist()
            ply = kmf.survival_function_[group_unique_list[i]].values.tolist()
            
            # 圖片的線條換顏色，調整粗細 都在這迴圈裡面修改
            trace_line = current_series.copy()
            trace_line["name"] = f"Group {group_unique_list[i]} (n={paramSize})"
            trace_line["legendgroup"] = f"Group {group_unique_list[i]} (n={paramSize})"
            trace_line["x"] = self.convert_days_to_Months(plx)
            trace_line["y"] = ply
            trace_line["hovertemplate"] = '%{y:.2f}'
            chart_series.append(trace_line)
            
            # 获取风险表
            risk_table = kmf.event_table
            risk_x = risk_table.index.tolist()
            risk_y = risk_table['at_risk'] - 1
            risk_y = risk_y.tolist()
            risk_y[0] = risk_y[0] + 1

            trace_line = current_series.copy()
            trace_line["yaxis"] = "y2"
            trace_line["showlegend"] = False
            trace_line["name"] = f"Group {group_unique_list[i]} (n={paramSize})"
            trace_line["legendgroup"] = f"Group {group_unique_list[i]} (n={paramSize})"
            trace_line["x"] = self.convert_days_to_Months(risk_x)
            trace_line["y"] = risk_y
            chart_series.append(trace_line)
            
            if y2_range < max(risk_y):
                y2_range = max(risk_y)

            # 這個是圖片上黑色marker，也要可以修改顏色和大小
            sur = kmf.survival_function_

            list_A = event[group_filter].tolist()
            list_B = date[group_filter].tolist()
            
            temp_x = []
            temp_y = []
            for x in range(len(list_A)):
                if list_A[x] == 0:
                    temp_x.append(list_B[x])
                    temp_y.append(float(sur.loc[list_B[x]]))
            
            trace_marker = trace_black.copy()
            trace_marker["x"] = self.convert_days_to_Months(temp_x)
            trace_marker["y"] = temp_y
            trace_marker["hovertemplate"] = 'Censors: %{text:.2f}<extra></extra>'
            trace_marker["text"] = temp_y
            
            chart_series.append(trace_marker)
            
            # 
            list_A = risk_table['observed'].tolist()
            list_B = risk_table.index.tolist()
            
            temp_x = []
            temp_y = []
            temp_n = []
            n = 0
            for x in range(len(list_A)):
                if list_A[x] == 0 and x != 0:
                    temp_x.append(list_B[x])
                    temp_y.append(float(risk_y[x]))
                    n += 1
                    temp_n.append(n)
                    
            
            trace_marker = trace_black.copy()
            trace_marker["yaxis"] = "y2"
            trace_marker["showlegend"] = False
            trace_marker["x"] = self.convert_days_to_Months(temp_x)
            trace_marker["y"] = temp_y
            trace_marker["hovertemplate"] = 'Accum. censors: %{text}<extra></extra>'
            trace_marker["text"] = temp_n
            chart_series.append(trace_marker)
        
        temp_layout = const_layout.copy()
        temp_layout["yaxis2"]["range"][1] = y2_range
        chart_data = [dict(
                    chart1_data = Data(chart_series),
                    layout = temp_layout
                )
            ]
        return chart_data

    def fig(self, data, layout):
        fig = go.Figure(
            data=data,
            layout=layout
        )
        fig.show()

    def get_censor(self, df, status_col, day_col, groups_col):

        date = df[day_col]
        event = df[status_col]
        group = df[groups_col]
        
        
        i1 = (group == "H")
        i2 = (group == "L")
        temp_x1 = []
        temp_x2 = []
        temp_y1 = []
        temp_y2 = []

        kmfH = KaplanMeierFitter()
        kmfH.fit(date[i1], event[i1], label="H")
        H = df[i1]
        H_sur = kmfH.survival_function_

        list_A = H[status_col].tolist()
        list_B = H[day_col].tolist()

        for x in range(len(list_A)):
            if list_A[x] == 0:
                temp_x1.append(list_B[x])
                temp_y1.append(float(H_sur.loc[list_B[x]]))

        kmfL = KaplanMeierFitter()
        kmfL.fit(date[i2], event[i2], label="L")
        L = df[i2]
        L_sur = kmfL.survival_function_

        list_A = L[status_col].tolist()
        list_B = L[day_col].tolist()

        for x in range(len(list_A)):
            if list_A[x] == 0:
                temp_x2.append(list_B[x])
                temp_y2.append(float(L_sur.loc[list_B[x]]))

        return temp_x1, temp_y1, temp_x2, temp_y2

    def convert_days_to_Months(self, list):
        list = [x*0.03285 for x in list]
        return list

    def get_download_data(self, category, cancer_type, meta_feature, mode, time=0, L_per=50, H_per=50):
        mode = mode.upper()

        new_df = self.get_logrank_data(category, cancer_type, meta_feature, mode)
        new_df = self.drop_nan(new_df, ['Expression', mode, mode + '.time'])
        new_df = self.seperate_group(new_df, 'Expression', mode, mode + '.time', time=time, L_per=L_per, H_per=H_per)

        return new_df

    def get_gene(self, metafeature):
        cur_coll = self.mongodb_conn["cancer_genome_lncrna"]
        myquery = {"type": 'BLCA', "MetaFeature": metafeature}
        exclude_fields = {"category": False, "type": False, "Cgcite": False}
        df = pd.DataFrame(cur_coll.find(myquery, exclude_fields))
        a = df['MetaFeature'].tolist()
        b = df['gene_symbol'].tolist()
        dic = dict(zip(a, b))
        return dic[metafeature]

    def get(self, category, cancer_type, meta_feature, mode, time=0, L_per=50, H_per=50):
        
        if category == 'lncrna':
            # gene = self.get_gene(meta_feature)
            gene = meta_feature
        elif category == 'mrna':
            gene = meta_feature.split("|")[0]
        elif category == 'mirna':
            gene = meta_feature.split(",")[0]
        else:
            gene = meta_feature

        mode = mode.upper()

        exp_col = 'Expression'
        status_col = mode
        day_col = mode + '.time'
        
        response = {'status': 'SUCCESS'}
        # input的項目：1. category Ex. mrna 2. types Ex. ACC 3.gene_name 4. survival_type(mode) Ex. DSS
        # types = 'ACC'
        # mode = 'DSS'


        if mode == 'OS':
            title = "Overall"
        elif mode == 'DFI':
            title = "Disease-Free"
        elif mode == 'DSS':
            title = "Disease-Specific"
        elif mode == 'PFI':
            title = "Progression-Free"
            
        new_df = self.get_logrank_data(category, cancer_type, meta_feature, mode)
        new_df = self.drop_nan(new_df, [exp_col, status_col, day_col])
        new_df = self.seperate_group(new_df, exp_col, status_col, day_col, time=time, L_per=L_per, H_per=H_per)

        p_val = self.log_rank(new_df, status_col, day_col)

        try:
            chart_data = self.drawkmplot(new_df, status_col, day_col, 'groups')
            
            if int(time) in [3, 5, 10]:
                chart_data[0]['layout']["title"] = time+" years, "+cancer_type + ", " + gene + \
                    " "+title+" survival, p-val: " + \
                    str(format(float(p_val), ".2E"))
            else:
                chart_data[0]['layout']["title"] = cancer_type + ", " + gene + " " + title + " survival, p-val: " + str(
                    format(float(p_val), ".2E"))
            # self.fig(data1,export_layout)

            response['chart_data'] = chart_data
            response["p_val"] = p_val

            return response
        except Exception as e:
            if L_per == "0" and H_per == "0":
                raise Exception(str(e))
            else:
                raise Exception('Invalid input percentage')

    def get_logrank_data(self, category, cancer_type, meta_feature, mode):
        mode = mode.upper()

        
        excel_df = self.get_survival_data(cancer_type)

        genome_dataset = self.get_genome(category, cancer_type, meta_feature)
        exp_df = pd.DataFrame(genome_dataset)

        new_df = self.get_exp(excel_df, exp_df)

        return new_df

    def get_mkpolt(self, df, exp_col, status_col, day_col, time=0, L_per=50, H_per=50):
        response = {'status': 'success'}
        
        df = self.drop_nan(df, [exp_col, status_col, day_col])
        df = self.seperate_group(df, exp_col, status_col, day_col, time=time, L_per=L_per, H_per=H_per)

        p_val = self.log_rank(df, status_col, day_col)
        
        
        try:
            chart_data = self.drawkmplot(df, status_col, day_col, 'groups')

            if int(time) in [3, 5, 10]:
                chart_data[0]['layout']["title"] = time + " years, survival, p-val: %e" % (float(p_val))
            else:
                chart_data[0]['layout']["title"] = "p-val: %.e" % (float(p_val))
            # self.fig(data1,export_layout)

            response['chart_data'] = chart_data
            response["p_val"] = p_val

        except Exception as e:
            response['status'] = 'error'
            if L_per == "0" and H_per == "0":
                # raise Exception(str(e))
                response['message'] = str(e)
            else:
                # raise Exception('Invalid input percentage')
                response['message'] = 'Invalid input percentage'
        return response

#####

    def get_expression_data(self, type, category, gene):
        mongo_col = self.mongodb_conn["cancer_genome_" + category]
        myquery = {
            'type': type
        }
        if category == "lncrna":
            myquery["gene_symbol"] = gene
        else:
            # myquery["MetaFeature"] = gene
            myquery["MetaFeature"] = {"$regex": f"(^{gene}([;|,]))|^({gene})$"}

        data = list(mongo_col.find(
            myquery, {'_id': False, 'category': False, 'type': False}))

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

        data2 = pd.DataFrame(data)
        return data2

    def calculate_logrank_by_mode(self, category, full_survial_df, expression_df, meta_feature, mode):
        data1 = full_survial_df[[
            'bcr_patient_barcode', 'type', mode, f'{mode}.time']]
        if category != 'lncrna':
            new_df = self.get_exp(
                data1, expression_df[expression_df['MetaFeature'] == meta_feature], meta_feature)
        else:
            new_df = self.get_exp(
                data1, expression_df[expression_df['gene_symbol'] == meta_feature], meta_feature)
        
        return new_df

    def df_intersection(self, df1, df2, group1, group2, merge_on_col):
        df1_group, df2_group = df1["groups"], df2["groups"]
        df1_i1 = (df1_group == "H")
        df1_i2 = (df1_group == "L")

        df2_i1 = (df2_group == "H")
        df2_i2 = (df2_group == "L")

        if group1 == 'H' and group2 == 'H':
            df1 = df1[df1_i1]
            df2 = df2[df2_i1]
        elif group1 == 'H' and group2 == 'L':
            df1 = df1[df1_i1]
            df2 = df2[df2_i2]
        elif group1 == 'L' and group2 == 'H':
            df1 = df1[df1_i2]
            df2 = df2[df2_i1]
        elif group1 == 'L' and group2 == 'L':
            df1 = df1[df1_i2]
            df2 = df2[df2_i2]

        intersected_df = pd.merge(
            df1, df2, on=merge_on_col, how='inner')
        intersected_df["group_by"] = group1 + group2
        return intersected_df

    def reset_df(self, df, group1, group2):
        if not isinstance(group1, list):
            group1 = [group1]
        if not isinstance(group2, list):
            group2 = [group2]
        
        temp = group1.copy()
        temp.extend(group2)
        df = df[df["group_by"].isin(temp)]

        temp_list = df["group_by"].tolist()
        temp_list = ['1' if x in group1 else '2' for x in temp_list]

        df["group_by"] = temp_list

        return df

    
    def get_two_gene_data(self, category1, category2, gene1, gene2, cancer_type, group1, group2):
        
        full_survial_df = self.get_survival_data(cancer_type)
        g1_exp_df = self.get_expression_data(cancer_type, category1, gene1)
        g2_exp_df = self.get_expression_data(cancer_type, category2, gene2)
        modes = ["OS", "PFI", 'DFI', 'DSS']

        index_col = 'bcr_patient_barcode'
        
        res = []
        for mode in modes:
            status_col = mode
            day_col = mode + '.time'
            
            if mode == 'OS':
                full_name = 'Overall'
            elif mode == 'DFI':
                full_name = 'Disease-Free'
            elif mode == 'PFI':
                full_name = 'Progression-Free'
            elif mode == 'DSS':
                full_name = 'Disease-Specific'
            try:
                df1 = self.calculate_logrank_by_mode(
                    category1, full_survial_df, g1_exp_df, gene1, mode)
                df2 = self.calculate_logrank_by_mode(
                    category2, full_survial_df, g2_exp_df, gene2, mode)

                df1 = self.drop_nan(df1, [index_col, gene1, status_col, day_col])
                df2 = self.drop_nan(df2, [index_col, gene2, status_col, day_col])

                df1 = self.seperate_group(df1, gene1, status_col, day_col)
                df2 = self.seperate_group(df2, gene2, status_col, day_col)
                dfHH = self.df_intersection(df1, df2, 'H', 'H', [index_col, status_col, day_col])
                dfHL = self.df_intersection(df1, df2, 'H', 'L', [index_col, status_col, day_col])
                dfLH = self.df_intersection(df1, df2, 'L', 'H', [index_col, status_col, day_col])
                dfLL = self.df_intersection(df1, df2, 'L', 'L', [index_col, status_col, day_col])
                
                HH = dfHH.shape[0]
                HL = dfHL.shape[0]
                LH = dfLH.shape[0]
                LL = dfLL.shape[0]

                new_df = pd.concat([dfHH, dfHL, dfLH, dfLL], ignore_index=True)
                new_df = self.reset_df(new_df, group1, group2)

                res.append({
                    "survival_type": full_name,
                    "patients": new_df.shape[0],
                    "p_val": str(format(float(self.log_rank(new_df, status_col, day_col, "group_by")), ".2E")),
                    "shape": {
                        "HH": HH,
                        "HL": HL,
                        "LH": LH,
                        "LL": LL
                    }
                })
            except Exception as e:
                raise Exception(str(e))
        return res

    def get_two_gene_img_data(self, category1, category2, mode, gene1, gene2, cancer_type, group1, group2, time):
        mode = mode.upper()

        if mode == 'OS':
            title = "Overall"
        elif mode == 'DFI':
            title = "Disease-Free"
        elif mode == 'DSS':
            title = "Disease-Specific"
        elif mode == 'PFI':
            title = "Progression-Free"

        index_col = 'bcr_patient_barcode'
        status_col = mode
        day_col = mode + '.time'
        
        response = {'status': 'SUCCESS'}

        full_survial_df = self.get_survival_data(cancer_type)
        g1_exp_df = self.get_expression_data(cancer_type, category1, gene1)
        g2_exp_df = self.get_expression_data(cancer_type, category2, gene2)
        df1 = self.calculate_logrank_by_mode(
            category1, full_survial_df, g1_exp_df, gene1, mode)
        df2 = self.calculate_logrank_by_mode(
            category2, full_survial_df, g2_exp_df, gene2, mode)

        df1 = self.drop_nan(df1, [index_col, gene1, status_col, day_col])
        df2 = self.drop_nan(df2, [index_col, gene2, status_col, day_col])

        df1 = self.seperate_group(df1, gene1, status_col, day_col)
        df2 = self.seperate_group(df2, gene2, status_col, day_col)
        
        dfHH = self.df_intersection(df1, df2, 'H', 'H', [index_col, status_col, day_col])
        dfHL = self.df_intersection(df1, df2, 'H', 'L', [index_col, status_col, day_col])
        dfLH = self.df_intersection(df1, df2, 'L', 'H', [index_col, status_col, day_col])
        dfLL = self.df_intersection(df1, df2, 'L', 'L', [index_col, status_col, day_col])
        
        new_df = pd.concat([dfHH, dfHL, dfLH, dfLL], ignore_index=True)
        new_df = self.reset_df(new_df, group1, group2)
        if len(new_df['group_by'].unique()) != 2:
            response['status'] = "WARNING"
            
            if len(new_df['group_by'].unique()) == 1:
                response['message'] = "No patient in group %s." % (1 if new_df['group_by'].unique() == ["2"] else 2)
            else:
                response['message'] = "No patient was found in both groups"
                
            return response
        
        if int(time) != 0:
            new_df = self.follow_up_threshold(new_df, status_col, day_col, time)

        # print("@new_df = ", new_df)
        pval = self.log_rank(new_df, status_col, day_col, "group_by")

        chart_data = self.drawkmplot(new_df, status_col, day_col, 'group_by')
        
        if int(time) in [3,5,10]:
            chart_data[0]['layout']["title"] = time + " years, "+cancer_type +', '+ title+" survival, p-val: " + \
                str(format(float(pval), ".2E"))
        else:
            chart_data[0]['layout']["title"] =  cancer_type + ', ' + title + " survival, p-val: " + \
                                     str(format(float(pval), ".2E"))

        response['chart_data'] = chart_data
        return response
    
    def get_download_two_gene_data(self, category1, category2, mode, gene1, gene2, cancer_type, group1, group2):
    
        mode = mode.upper()
        index_col = 'bcr_patient_barcode'
        status_col = mode
        day_col = mode + '.time'

        full_survial_df = self.get_survival_data(cancer_type)
        g1_exp_df = self.get_expression_data(cancer_type, category1, gene1)
        g2_exp_df = self.get_expression_data(cancer_type, category2, gene2)
        df1 = self.calculate_logrank_by_mode(
            category1, full_survial_df, g1_exp_df, gene1, mode)
        df2 = self.calculate_logrank_by_mode(
            category2, full_survial_df, g2_exp_df, gene2, mode)

        df1 = self.drop_nan(df1, [index_col, gene1, status_col, day_col])
        df2 = self.drop_nan(df2, [index_col, gene2, status_col, day_col])

        df1 = self.seperate_group(df1, gene1, status_col, day_col)
        df2 = self.seperate_group(df2, gene2, status_col, day_col)
         
        dfHH = self.df_intersection(df1, df2, 'H', 'H', [index_col, status_col, day_col])
        dfHL = self.df_intersection(df1, df2, 'H', 'L', [index_col, status_col, day_col])
        dfLH = self.df_intersection(df1, df2, 'L', 'H', [index_col, status_col, day_col])
        dfLL = self.df_intersection(df1, df2, 'L', 'L', [index_col, status_col, day_col])
        
        new_df = pd.concat([dfHH, dfHL, dfLH, dfLL], ignore_index=True)

        return new_df

