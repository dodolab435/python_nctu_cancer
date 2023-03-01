
import sys
import traceback
import pandas as pd
import statistics
import plotly as py
import math
import json
import pymongo

from python_nctu_cancer.settings import CUSTOM_SETTINGS
from plotly.graph_objs import Data
from lifelines import KaplanMeierFitter


class BoxPlot:

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

    def log_list(self, list):
        result = []
        for x in list:
            try:
                result.append(round(math.log(x+0.01, 10), 3))
            except:
                result.append("")

        return result

    def get_genome_by_metafeature(self, category, meta_feature):
        cur_coll = self.mongodb_conn[f"cancer_genome_{category.lower()}"]
        myquery = {}
        if "methylation" in category:
            myquery = {"Cgcite": meta_feature}
        elif category == "lncrna":
            myquery = {"gene_symbol": meta_feature}
        else:
            myquery = {"MetaFeature": meta_feature}

        exclude_fields = {'_id': False,
                          'category': False, 'MetaFeature': False}
        return cur_coll.find(myquery, exclude_fields)

    def get_data(self, category, meta_feature):
        genome_dataset = self.get_genome_by_metafeature(category, meta_feature)

        result = {}
        for type_group_dataset in genome_dataset:
            type_name = ''
            normal_expressions = []
            tumor_expressions = []
            for y in type_group_dataset:
                try:
                    if y == 'type':
                        type_name = type_group_dataset['type']
                    else:
                        toks = y.split('-')
                        t = toks[3][0:2]
                        if type_group_dataset[y]!='NaN' and type_group_dataset[y]!='nan':
                            if t in ['01', '02', '03', '05']:
                                tumor_expressions.append(
                                    float(type_group_dataset[y]))
                            elif t in ['10', '11', '12', '13', '14', '15', '16', '17', '18', '19']:
                                normal_expressions.append(
                                    float(type_group_dataset[y]))
                except:
                    continue

            if 'protein' in category:
                pass
            else:
                normal_expressions = self.log_list(normal_expressions)
                tumor_expressions = self.log_list(tumor_expressions)

            result[type_name] = {
                "normal": normal_expressions, "tumor": tumor_expressions}
            print(result)
        return result
