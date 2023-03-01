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
        if "methylation" in category:
            myquery = {"type": cancer_type, "Cgcite": meta_feature}
        else:
            myquery = {"type": cancer_type, "MetaFeature": meta_feature}
        exclude_fields = {"category": False, "type": False, "Cgcite": False}
        return cur_coll.find(myquery, exclude_fields)

    def get_survival_data(self, cancer_type, excel_df):

        survival_data = excel_df.loc[excel_df['type'] == cancer_type]
        survival_data = survival_data[['bcr_patient_barcode', 'type', 'OS',
                                       'OS.time', 'DSS', 'DSS.time', 'DFI', 'DFI.time', 'PFI', 'PFI.time']]

        return survival_data

    def get_exp(self, df1, df2):
        temp = df1['bcr_patient_barcode'].tolist()

        exp = df2.iloc[0].tolist()
        # print("exp = ", exp[0])
        # exp = exp[1:]

        a = list(df2.columns.values)
        a = [i[:12] for i in a]
        dic1 = dict(zip(a, exp))

        h = 0
        templist = []
        for x in temp:
            if x in dic1:
                templist.append(dic1[x])
            else:
                templist.append(float('nan'))

        df1['Expression'] = templist

        return df1

    # 將NA資料排除
    def drop_nan(self, df, mode):

        df = df.dropna(subset=["Expression"])
        df = df[df["Expression"] != 'NA']
        df = df[df["Expression"] != 'NaN']

        df = df.dropna(subset=[mode])
        df = df.dropna(subset=[f"{mode}.time"])

        Med_list = [float(x) for x in df['Expression'].tolist()]
        Med = statistics.median(Med_list)

        df = df[['bcr_patient_barcode', 'type',
                 mode, mode+'.time', 'Expression']]

        return df, Med

    def follow_up_threshold(self, df, mode, time):
        limit = 1096
        if int(time) == 3:
            limit = 1096
        elif int(time) == 5:
            limit = 1826
        elif int(time) == 10:
            limit = 3653

        # print("@time =", time, ", @limit = ", limit)
        list1 = df[mode+'.time'].tolist()
        list2 = df[mode].tolist()

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
        df[mode] = temp_mode
        df[mode+'.time'] = temp_time
        return df

    # 表現量分群
    def seperate_group(self, df, Med, mode, time, L_per, H_per):
        time = int(time)
        L_per = int(L_per)
        H_per = int(H_per)
        if L_per < 0:
            L_per = 0
        if L_per > 100:
            L_per = 100
        if H_per < 0:
            H_per = 0
        if H_per > 100:
            H_per = 100
        # 要先確定原本patient人數有超過一百個才可以讓使用者輸入，否則拒絕輸入  if df.shape[0] > 100:

        #if是指default的狀態和else是使用者輸入後
        if H_per==0 and L_per==0:
            temp = []
            templist = df['Expression'].tolist()
            templist = [float(y) for y in templist]
            for x in templist:
                if x >= Med:
                    temp.append('H')
                else:
                    temp.append('L')

            df['groups'] = temp
        else:
            df = df.sort_values(by=['Expression'])
            nH = (df.shape[0]*(H_per/100))//1
            nL = (df.shape[0]*(L_per/100))//1
            df1 = df.iloc[-int(nH):]
            df1['groups']='H'
            df2 = df.iloc[0:int(nL)]
            df2['groups']='L'
            df = pd.concat([df1,df2],axis=0, ignore_index=True)

        if time==0:
            return df
        else:
            df = self.follow_up_threshold(df,mode,time)
            return df

    def log_rank(self, df, mode):
        date_df = df[f"{mode}.time"]
        event_df = df[mode]

        group = df["groups"]
        i1 = (group == "L")
        i2 = (group == "H")
        results = logrank_test(
            date_df[i1], date_df[i2], event_observed_A=event_df[i1], event_observed_B=event_df[i2])
        return str(results.p_value)

    def drawkmplot(self, df, mode):
        # print(df)
        date = df[mode+".time"]
        event = df[mode]

        group = df["groups"]
        i1 = (group == "H")
        i2 = (group == "L")
        paramHSize = len(date[i1])
        paramLSize = len(date[i2])
        # print("H: "+str(paramHSize))
        # print("L: "+str(paramLSize))
        kmf = KaplanMeierFitter()
        kmf.fit(date[i1], event[i1], label="H")

        a1 = kmf.plot(ci_show=False)
        line = a1.lines[0]
        plx = line.get_xdata()
        ply = line.get_ydata()

        kmf.fit(date[i2], event[i2], label="L")
        a2 = kmf.plot(ci_show=False)
        line2 = a2.lines[1]

        plx2 = line2.get_xdata()
        ply2 = line2.get_ydata()

        chart_data = [
            {"name": f"H (n={paramHSize})", "x": plx, "y": ply},
            {"name": f"L (n={paramLSize})", "x": plx2, "y": ply2}
        ]
        return chart_data

    def fig(self, data, layout):
        fig = go.Figure(
            data=data,
            layout=layout
        )
        fig.show()

    def get_censor(self, df, mode):

        date = df[mode+".time"]
        event = df[mode]

        group = df["groups"]
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

        list_A = H[mode].tolist()
        list_B = H[mode+'.time'].tolist()

        for x in range(len(list_A)):
            if list_A[x] == 0:
                temp_x1.append(list_B[x])
                temp_y1.append(float(H_sur.loc[list_B[x]]))

        kmfL = KaplanMeierFitter()
        kmfL.fit(date[i2], event[i2], label="L")
        L = df[i2]
        L_sur = kmfL.survival_function_

        list_A = L[mode].tolist()
        list_B = L[mode + '.time'].tolist()

        for x in range(len(list_A)):
            if list_A[x] == 0:
                temp_x2.append(list_B[x])
                temp_y2.append(float(L_sur.loc[list_B[x]]))

        return temp_x1, temp_y1, temp_x2, temp_y2

    def convert_days_to_Months(self, list):
        list = [x*0.03285 for x in list]
        return list

    def get_download_data(self, category, cancer_type, meta_feature, mode, time, L_per, H_per):
        mode = mode.upper()

        path = os.path.abspath(os.path.dirname(__name__)) + \
            os.sep + "python_nctu_cancer" + os.sep
        excel_df = pd.read_excel(
            path + 'Supplemental/TCGA-CDR-SupplementalTableS1.xlsx')
        excel_df = self.get_survival_data(cancer_type, excel_df)

        genome_dataset = self.get_genome(category, cancer_type, meta_feature)
        exp_df = pd.DataFrame(genome_dataset)

        new_df = self.get_exp(excel_df, exp_df)

        new_df, Med = self.drop_nan(new_df, mode)
        new_df = self.seperate_group(new_df, Med, mode, time, L_per, H_per)

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

    def get(self, category, cancer_type, meta_feature, mode, time, L_per, H_per):
        
        if category == 'lncrna':
            gene = self.get_gene(meta_feature)
        elif category == 'mrna':
            gene = meta_feature.split("|")[0]
        elif category == 'mirna':
            gene = meta_feature.split(",")[0]
        else:
            gene = meta_feature

        mode = mode.upper()

        const_layout = {
            "title": "DNA overall survival",
            "legend": {
                "x": 1.05,
                "y": 1
            },
            "xaxis1": {
                "dtick": 10,
                "side": "bottom",
                "type": "linear",
                "ticks": "inside",
                "title": "Survival Time (Months)",
                "anchor": "y1",
                "domain": [
                    0,
                    1
                ],
                "mirror": "ticks",
                "nticks": 10,
                "showgrid": False,
                "showline": True,
                "tickfont": {
                    "size": 10
                },
                "zeroline": False,
                "titlefont": {
                    "size": 12,
                    "color": "#000000"
                }
            },
            "yaxis1": {
                "title": 'Probability of Survival',
                "dtick": 0.1,
                "side": "left",
                "type": "linear",
                "ticks": "inside",
                "anchor": "x1",
                "range": [
                    0,
                    1
                ],
                "domain": [
                    0,
                    1
                ],
                "mirror": "ticks",
                "nticks": 10,
                "showgrid": False,
                "showline": True,
                "tickfont": {
                    "size": 10
                },
                "zeroline": False
            },
            "hovermode": "closest",
            "titlefont": {
                "size": 12,
                "color": "#000000"
            },
            "showlegend": True

        }

        response = {'status': 'SUCCESS'}
        # input的項目：1. category Ex. mrna 2. types Ex. ACC 3.gene_name 4. survival_type(mode) Ex. DSS
        # types = 'ACC'
        # mode = 'DSS'

        path = os.path.abspath(os.path.dirname(__name__)) + \
            os.sep + "python_nctu_cancer" + os.sep

        if mode == 'OS':
            title = "Overall"
        elif mode == 'DFI':
            title = "Disease-Free"
        elif mode == 'DSS':
            title = "Disease-Specific"
        elif mode == 'PFI':
            title = "Progression-Free"
        excel_df = pd.read_excel(
            path + 'Supplemental/TCGA-CDR-SupplementalTableS1.xlsx')
        excel_df = self.get_survival_data(cancer_type, excel_df)

        genome_dataset = self.get_genome(category, cancer_type, meta_feature)
        exp_df = pd.DataFrame(genome_dataset)

        new_df = self.get_exp(excel_df, exp_df)

        new_df, Med = self.drop_nan(new_df, mode)
        new_df = self.seperate_group(new_df, Med, mode, time, L_per, H_per)

        p_val = self.log_rank(new_df, mode)

        try:
            # new_df.to_csv('clinical_data_'+mode+".csv")
            analysis_results = self.drawkmplot(new_df, mode)

            chart_series = []
            # 圖片的線條換顏色，調整粗細 都在這迴圈裡面修改
            for result in analysis_results:
                if result["name"][0] == 'H':
                    current_series = {
                        "line": {
                            "dash": "solid",
                            "shape": "hv",
                            "color": "red",
                            "width": 2.0,
                        },
                        "mode": "lines",
                    }
                    current_series["name"] = result["name"]

                    current_series["x"] = self.convert_days_to_Months(
                        result["x"].tolist())

                    current_series["y"] = result["y"]

                    # rgb(255,0,0)

                    chart_series.append(current_series)
                else:
                    current_series = {
                        "line": {
                            "dash": "solid",
                            "shape": "hv",
                            "color": "blue",
                            "width": 2.0,
                        },
                        "mode": "lines",
                    }
                    current_series["name"] = result["name"]
                    current_series["x"] = self.convert_days_to_Months(
                        result["x"].tolist())

                    current_series["y"] = result["y"]

                    # rgb(255,0,0)

                    chart_series.append(current_series)
            # 抓出Censor的座標
            a, b, c, d = self.get_censor(new_df, mode)

            # 這個是圖片上黑色marker，也要可以修改顏色和大小
            trace3 = {
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
            trace3["x"] = self.convert_days_to_Months(a)
            trace3["y"] = b

            trace4 = {
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
            trace4["x"] = self.convert_days_to_Months(c)
            trace4["y"] = d
            chart_series.append(trace3)
            chart_series.append(trace4)

            data1 = Data(chart_series)

            export_layout = const_layout.copy()
            if int(time) in [3, 5, 10]:
                export_layout["title"] = time+" years, "+cancer_type + ", " + gene + \
                    " "+title+" survival, p-val: " + \
                    str(format(float(p_val), ".2E"))
            else:
                export_layout[
                    "title"] = cancer_type + ", " + gene + " " + title + " survival, p-val: " + str(
                    format(float(p_val), ".2E"))
            # self.fig(data1,export_layout)
            graphs = [
                dict(
                    chart1_data=data1,
                    layout=export_layout
                )
            ]

            response['chart_data'] = graphs
            # response["p_val"] = p_val

            # print(json.dumps(response, cls=py.utils.PlotlyJSONEncoder))
            return response
        except Exception as e:
            if L_per == "0" and H_per == "0":
                raise Exception(str(e))
            else:
                raise Exception('Invalid input percentage')
