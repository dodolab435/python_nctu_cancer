
import sys
import traceback

import pandas as pd
from scipy import stats
import numpy
import pandas as pd
import numpy as np
import matplotlib
matplotlib.use('AGG')
import matplotlib.pyplot as plt
import base64
import json
import os
import pymongo
import math

from python_nctu_cancer.settings import CUSTOM_SETTINGS
from io import BytesIO

class Correlation:

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

    def get_genome_by_metafeature(self, category, type, meta_feature, cgcite=""):
        mongodb_conn = self.mongodb_conn
        cur_coll = mongodb_conn[f"cancer_genome_{category.lower()}"]

        myquery = {}
        myquery["type"] = type
        if len(meta_feature.split('|')) > 1:
            myquery["MetaFeature"] = { "$regex": f"^{meta_feature.split('|')[0]}.*{meta_feature.split('|')[1]}$"}
        else:
            myquery["MetaFeature"] = { "$regex": f"(^{meta_feature}(;|\\|))|^({meta_feature})$|(;[\s]*{meta_feature}$)"}

        if cgcite != "":
            myquery["Cgcite"] = cgcite
            
        exclude_fields = {'_id': False, 'category': False, 'type': False, 'MetaFeature': False}
        res = cur_coll.find(myquery, exclude_fields)

        return res

    def trans_genome_list(self, dataset):
        results = []
        for type_group_dataset in dataset:
            for col in type_group_dataset:
                if col.lower() in ["cgcite", "type"]:
                    continue
                try:
                    results.append(float(type_group_dataset[col]))
                except Exception as err:
                    print(err)
            break
        return results

    # 取出數值
    def get_correlation_result(self, category, cancer_type, meta_feature, entrez, cgcite):
        # 取出空值不繼續執行
        tmp_genome2 = self.get_genome_by_metafeature(category, cancer_type, meta_feature, cgcite)
        list_genome2 = self.trans_genome_list(tmp_genome2)

        if (len(list_genome2) == 0):
            print(list_genome2)
            return []
        
        tmp_genome = self.get_genome_by_metafeature("mrna", cancer_type, meta_feature + "|" + entrez)
        list_genome = self.trans_genome_list(tmp_genome)

        if len(list_genome) == 0:
            return []

        # 兩個欄位資料長度需要一致否則會出錯
        len1 = len(list_genome)
        len2 = len(list_genome2)
        if len1 > 0 and len2 > 0:
            # 移除長度較長的最後一個
            diff = abs(len1 - len2)
            if len1 > len2:
                for j in range(diff):
                    list_genome.pop(len(list_genome) - 1)
            else:
                for j in range(diff):
                    list_genome2.pop(len(list_genome2) - 1)

        #print(list_genome)
        arr1 = numpy.array(list_genome)
        arr2 = numpy.array(list_genome2)
        res1 = list(stats.pearsonr(arr1, arr2))
        res2 = list(stats.spearmanr(arr1, arr2))
        res1 = [ format(x, ".2E")for x in res1]
        res2 = [ format(x, ".2E")for x in res2]
        return res1 + res2

    # 取出圖片
    def get_correlation_img(self, category, cancer_type, meta_feature, entrez, cgcite):
        # 取出空值不繼續執行
        tmp_genome2 = self.get_genome_by_metafeature(category, cancer_type, meta_feature, cgcite)
        list_genome2 = self.trans_genome_list(tmp_genome2)

        if (len(list_genome2) == 0):
            return []
        
        tmp_genome = self.get_genome_by_metafeature("mrna", cancer_type, meta_feature + "|" + entrez)
        list_genome = self.trans_genome_list(tmp_genome)

        if len(list_genome) == 0:
            return []

        # 兩個欄位資料長度需要一致否則會出錯
        len1 = len(list_genome)
        len2 = len(list_genome2)
        if len1 > 0 and len2 > 0:
            # 移除長度較長的最後一個
            diff = abs(len1 - len2)
            if len1 > len2:
                for j in range(diff):
                    list_genome.pop(len(list_genome) - 1)
            else:
                for j in range(diff):
                    list_genome2.pop(len(list_genome2) - 1)

        # list_genome = [math.log(x) for x in list_genome]
        # list_genome2 = [math.log(x) for x in list_genome2]
        tmp_list_genome = []
        tmp_list_genome2 = []
        for x in list_genome:
            try:
                if x > 0:
                    tmp_list_genome.append(math.log(x))
                else:
                    tmp_list_genome.append(0)
            except:
                tmp_list_genome.append(0)
        for x in list_genome2:
            try:
                if x > 0:
                    tmp_list_genome2.append(math.log(x))
                else:
                    tmp_list_genome2.append(0)
            except:
                tmp_list_genome2.append(0)
        list_genome = tmp_list_genome
        list_genome2 = tmp_list_genome2

        import seaborn as sns
        d = {'col1':list_genome,'col2':list_genome2}
        df = pd.DataFrame(data=d)
        sns.lmplot(x='col1', y='col2' , data=df)

        # plt.show()
        # 轉成圖片的步驟
        sio = BytesIO()

        gene = meta_feature
        if gene.find("|") != -1:
            gene = gene.split("|")[0]
        elif gene.find(",") != -1:
            gene = gene.split(",")[0]
        elif gene.find(";") != -1:
            gene = gene.split(";")[0]

        # 設定title, x, y軸
        #plt.title(cgcite)
        plt.xlabel("Log ("+ gene + " mRNA Expression value)")
        plt.ylabel("Log ("+ cgcite +" methylation level)")
        plt.savefig(sio, format='png', dpi=150, bbox_inches='tight')
        data = base64.encodebytes(sio.getvalue()).decode()

        html = '''
            <img class="correlationImg" src="data:image/png;base64,{}" />
        '''
        plt.close()

        return html.format(data)
