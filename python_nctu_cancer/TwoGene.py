import sys
import traceback
import os
import pandas as pd
import statistics
import plotly as py
import json
import pymongo
import plotly.graph_objects as go

from python_nctu_cancer.settings import CUSTOM_SETTINGS
from lifelines.statistics import logrank_test
from lifelines import KaplanMeierFitter
from plotly.graph_objs import Data


class TwoGene:
    path = os.path.abspath(os.path.dirname(__name__)) + \
        os.sep + "python_nctu_cancer" + os.sep
    #path = 'C:\\Users\\user\\Desktop\\Projects\\python_nctu_cancer\\python_nctu_cancer\\'

    mongodb_conn = None
    excel_df = None
    const_layout = {}

    def __init__(self):
        self.mongodb_conn = self.get_mongodb_conn()
        self.excel_df = pd.read_excel(
            self.path + 'Supplemental/TCGA-CDR-SupplementalTableS1.xlsx')
        self.const_layout = {
            "title": "DNA overall survival",
            "legend": {
                "x": 1.05,
                "y": 1
            },
            "xaxis1": {
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
                    "size": 10,
                    "color": "#000000"
                }
            },
            "yaxis1": {
                "title": "Probability of Survival",
                "side": "left",
                "type": "linear",
                "ticks": "inside",
                "anchor": "x1",
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

    def get_survival_data(self, type):

        survival_data = self.excel_df.loc[self.excel_df['type'] == type]
        survival_data = survival_data[['bcr_patient_barcode', 'type', 'OS',
                                       'OS.time', 'DSS', 'DSS.time', 'DFI', 'DFI.time', 'PFI', 'PFI.time']]

        return survival_data

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

    def get_exp(self, df1, df2):
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

        df1['Expression'] = templist

        return df1

    def drop_nan(self, df1, df2, mode):

        df1 = df1.dropna(subset=["Expression"])
        df1 = df1[df1["Expression"] != 'NA']
        df1 = df1[df1["Expression"] != 'NaN']

        # 更動

        df1 = df1.dropna(subset=[f"{mode}.time"])
        # 加上
        df1 = df1.dropna(subset=[mode])

        median1 = df1['Expression'].median().tolist()

        df2 = df2.dropna(subset=["Expression"])
        df2 = df2[df2["Expression"] != 'NA']
        df2 = df2[df2["Expression"] != 'NaN']

        # 更動


        df2 = df2.dropna(subset=[f"{mode}.time"])
        # 加上
        df2 = df2.dropna(subset=[mode])
        median2 = df2['Expression'].median().tolist()
        return df1, median1, df2, median2

    def follow_up_threshold(self, df, mode, time):
        if int(time) not in [3, 5, 10]:
            return df

        limit = 1096
        if int(time) == 3:
            limit = 1096
        elif int(time) == 5:
            limit = 1826
        elif int(time) == 10:
            limit = 3653

        list1 = df[mode+'.time_x'].tolist()
        list2 = df[mode+'_x'].tolist()

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
        df[mode+'_x'] = temp_mode
        df[mode+'.time_x'] = temp_time
        return df

    def calculate_logrank_by_mode(self, category, full_survial_df, expression_df, meta_feature, mode):
        data1 = full_survial_df[[
            'bcr_patient_barcode', 'type', mode, f'{mode}.time']]
        if category != 'lncrna':
            new_df = self.get_exp(
                data1, expression_df[expression_df['MetaFeature'] == meta_feature])
        else:
            new_df = self.get_exp(
                data1, expression_df[expression_df['gene_symbol'] == meta_feature])

        return new_df

    def seperate_group(self, df, median):
        temp = []
        templist = df['Expression'].tolist()
        templist = [float(y) for y in templist]

        for x in templist:
            if x >= median:
                temp.append('H')
            else:
                temp.append('L')

        df['groups'] = pd.Series(temp).values

        return df

    def df_intersection(self, df1, df2, group1, group2):
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
            df1, df2, on=['bcr_patient_barcode'], how='inner')
        intersected_df["group_by"] = group1+group2
        return intersected_df

    def drawkmplot(self, df, mode):

        date = df[mode+".time_x"]
        event = df[mode+"_x"]

        group = df["group_by"]
        i1 = (group == "1")
        i2 = (group == "2")
        paramHSize = len(date[i1])
        paramLSize = len(date[i2])
        # print(paramHSize)
        # print(paramLSize)
        kmf = KaplanMeierFitter()
        kmf.fit(date[i1], event[i1], label="Group1")

        a1 = kmf.plot(ci_show=False)
        line = a1.lines[0]
        plx = line.get_xdata()
        ply = line.get_ydata()

        kmf.fit(date[i2], event[i2], label="Group2")
        a2 = kmf.plot(ci_show=False)
        line2 = a2.lines[1]

        plx2 = line2.get_xdata()
        ply2 = line2.get_ydata()

        chart_data = [
            {"name": f"Group1 (n={paramHSize})", "x": plx, "y": ply},
            {"name": f"Group2 (n={paramLSize})", "x": plx2, "y": ply2}
        ]
        return chart_data

    def fig(self, data, layout):
        fig = go.Figure(
            data=data,
            layout=layout
        )
        fig.show()

    def get_censor(self, df, mode):

        date = df[mode+".time_x"]
        event = df[mode+"_x"]

        group = df["group_by"]
        i1 = (group == "1")
        i2 = (group == "2")
        temp_x1 = []
        temp_x2 = []
        temp_y1 = []
        temp_y2 = []

        kmfH = KaplanMeierFitter()
        kmfH.fit(date[i1], event[i1], label="group1")
        H = df[i1]
        H_sur = kmfH.survival_function_

        list_A = H[mode+"_x"].tolist()
        list_B = H[mode+'.time_x'].tolist()

        for x in range(len(list_A)):
            if list_A[x] == 0:
                temp_x1.append(list_B[x])
                temp_y1.append(float(H_sur.loc[list_B[x]]))
        kmfL = KaplanMeierFitter()
        kmfL.fit(date[i2], event[i2], label="group2")
        L = df[i2]
        L_sur = kmfL.survival_function_

        list_A = L[mode+"_x"].tolist()
        list_B = L[mode + '.time_x'].tolist()

        for x in range(len(list_A)):
            if list_A[x] == 0:
                temp_x2.append(list_B[x])
                temp_y2.append(float(L_sur.loc[list_B[x]]))

        return temp_x1, temp_y1, temp_x2, temp_y2

    def convert_days_to_Months(self, list):
        list = [x*0.03285 for x in list]
        return list

    def log_rank(self, df, mode):
        # print(df)
        date_df = df[f"{mode}.time_x"]
        event_df = df[mode+"_x"]

        group = df["group_by"]
        i1 = (group == "1")
        i2 = (group == "2")

        results = logrank_test(
            date_df[i1], date_df[i2], event_observed_A=event_df[i1], event_observed_B=event_df[i2])
        return str(format(results.p_value, ".2E"))

    def reset_df(self, df, group1, group2):
        temp = []
        group_list = ['HH', 'HL', 'LH', 'LL']
        for x in group1:
            temp.append(x)
        for x in group2:
            temp.append(x)

        drop_list = set(group_list)-set(temp)
        drop_list = list(drop_list)

        for x in drop_list:
            df = df[df["group_by"] != x]

        temp_list = df["group_by"].tolist()
        temp_list = ['1' if x in group1 else '2' for x in temp_list]

        df["group_by"] = temp_list

        return df

    def get_data(self, category1, category2, gene1, gene2, cancer_type, group1, group2):

        full_survial_df = self.get_survival_data(cancer_type)
        g1_exp_df = self.get_expression_data(cancer_type, category1, gene1)
        g2_exp_df = self.get_expression_data(cancer_type, category2, gene2)
        modes = ["OS", "PFI", 'DFI', 'DSS']

        res = []
        for mode in modes:
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

                df1, median_gene1, df2, median_gene2 = self.drop_nan(
                    df1, df2, mode)

                df1 = self.seperate_group(df1, median_gene1)
                df2 = self.seperate_group(df2, median_gene2)

                dfHH = self.df_intersection(df1, df2, 'H', 'H')
                dfHL = self.df_intersection(df1, df2, 'H', 'L')
                dfLH = self.df_intersection(df1, df2, 'L', 'H')
                dfLL = self.df_intersection(df1, df2, 'L', 'L')

                HH = dfHH.shape[0]
                HL = dfHL.shape[0]
                LH = dfLH.shape[0]
                LL = dfLL.shape[0]

                new_df = pd.concat([dfHH, dfHL, dfLH, dfLL], ignore_index=True)
                new_df = self.reset_df(new_df, group1, group2)

                # if mode == 'OS':
                #     full_name = 'Overall'
                # elif mode == 'DFI':
                #     full_name = 'Disease-Free'
                # elif mode == 'PFI':
                #     full_name = 'Progression-Free'
                # elif mode == 'DSS':
                #     full_name = 'Disease-Specific'

                res.append({
                    "survival_type": full_name,
                    "patients": new_df.shape[0],
                    "p_val": self.log_rank(new_df, mode),
                    "shape": {
                        "HH": HH,
                        "HL": HL,
                        "LH": LH,
                        "LL": LL
                    }
                })
            except Exception as e:
                res.append({
                    "survival_type": full_name,
                    "patients": "-",
                    "p_val": "-",
                    "shape": {
                        "HH": "-",
                        "HL": "-",
                        "LH": "-",
                        "LL": "-"
                    }
                })
        # print(res)
        # print(type(res))
        return res

    def get_img_data(self, category1, category2, mode, gene1, gene2, cancer_type, group1, group2, time):
        mode = mode.upper()

        if mode == 'OS':
            title = "Overall"
        elif mode == 'DFI':
            title = "Disease-Free"
        elif mode == 'DSS':
            title = "Disease-Specific"
        elif mode == 'PFI':
            title = "Progression-Free"

        response = {'status': 'SUCCESS'}

        full_survial_df = self.get_survival_data(cancer_type)
        g1_exp_df = self.get_expression_data(cancer_type, category1, gene1)
        g2_exp_df = self.get_expression_data(cancer_type, category2, gene2)
        df1 = self.calculate_logrank_by_mode(
            category1, full_survial_df, g1_exp_df, gene1, mode)
        df2 = self.calculate_logrank_by_mode(
            category2, full_survial_df, g2_exp_df, gene2, mode)

        df1, median_gene1, df2, median_gene2 = self.drop_nan(df1, df2, mode)

        df1 = self.seperate_group(df1, median_gene1)
        df2 = self.seperate_group(df2, median_gene2)

        dfHH = self.df_intersection(df1, df2, 'H', 'H')
        dfHL = self.df_intersection(df1, df2, 'H', 'L')
        dfLH = self.df_intersection(df1, df2, 'L', 'H')
        dfLL = self.df_intersection(df1, df2, 'L', 'L')

        new_df = pd.concat([dfHH, dfHL, dfLH, dfLL], ignore_index=True)
        new_df = self.reset_df(new_df, group1, group2)
        if len(new_df['group_by'].unique()) != 2:
            response['status'] = "WARNING"
            
            if len(new_df['group_by'].unique()) == 1:
                response['message'] = "No patient in group %s." % (1 if new_df['group_by'].unique() == ["2"] else 2)
            else:
                response['message'] = "No patient was found in both groups"
                
            return response
        new_df = self.follow_up_threshold(new_df, mode, time)

        # print("@new_df = ", new_df)
        pval = self.log_rank(new_df, mode)
        analysis_results = self.drawkmplot(new_df, mode)
        
        chart_series = []
        # 圖片的線條換顏色，調整粗細 都在這迴圈裡面修改
        for result in analysis_results:
            if "Group1" in result["name"]:
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

        export_layout = self.const_layout.copy()
        if int(time) in [3,5,10]:
            export_layout["title"] = time + " years, "+cancer_type +', '+ title+" survival, p-val: " + \
                str(format(float(pval), ".2E"))
        else:
            export_layout["title"] =  cancer_type + ', ' + title + " survival, p-val: " + \
                                     str(format(float(pval), ".2E"))
        # self.fig(data1, export_layout)
        graphs = [
            dict(
                chart1_data=data1,
                layout=export_layout
            )
        ]

        response['chart_data'] = graphs
        # response["p_val"] = p_val
        # print(response)
        # print(json.dumps(response, cls=py.utils.PlotlyJSONEncoder))
        return response

    def get_download_data(self, category1, category2, mode, gene1, gene2, cancer_type, group1, group2):

        full_survial_df = self.get_survival_data(cancer_type)
        g1_exp_df = self.get_expression_data(cancer_type, category1, gene1)
        g2_exp_df = self.get_expression_data(cancer_type, category2, gene2)

        df1 = self.calculate_logrank_by_mode(
            category1, full_survial_df, g1_exp_df, gene1, mode)
        df2 = self.calculate_logrank_by_mode(
            category2, full_survial_df, g2_exp_df, gene2, mode)

        df1, median_gene1, df2, median_gene2 = self.drop_nan(df1, df2, mode)

        df1 = self.seperate_group(df1, median_gene1)
        df2 = self.seperate_group(df2, median_gene2)

        dfHH = self.df_intersection(df1, df2, 'H', 'H')
        dfHL = self.df_intersection(df1, df2, 'H', 'L')
        dfLH = self.df_intersection(df1, df2, 'L', 'H')
        dfLL = self.df_intersection(df1, df2, 'L', 'L')

        new_df = pd.concat([dfHH, dfHL, dfLH, dfLL], ignore_index=True)

        return new_df
