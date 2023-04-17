#!/usr/bin/python
# coding:utf-8
import pymongo
from python_nctu_cancer.settings import CUSTOM_SETTINGS

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


class CancerCategoryModel():
    def get_types(cancer_category):
        cur_coll = mongo_db['cancer_type']
        myquery = {"name": cancer_category.lower()}

        return cur_coll.find(myquery)


class CancerLogRankModel():
    def get_logrank(category, cancer_type, gene_words, keyword="", limit=10, skip=0, sort_column="", sort_dir="", fields=[], survival_type=""):
        cur_coll = mongo_db['cancer_logrank']
        check_data = survival_type
        if category in ["methylation450k", "methylation27k"] or survival_type=="" :
            myquery = {
                "category": category.lower(),
                "type": cancer_type,
            }
        else:
            myquery = {
                "category": category.lower(),
                "type": cancer_type,
                "$and":[ {check_data:{"$ne": float('nan')} }, {check_data:{"$ne": "nan"}}, {check_data:{"$ne": "NA"}}, {check_data:{"$ne": ""}}, {check_data:{"$exists": "true"}}]
            }

        if gene_words != "":
            if category in ["mirna"]:
                myquery["MetaFeature"] = {"$regex": f"(^{gene_words},)"}
            elif category in ["lncrna"]:
                myquery["gene_symbol"] = gene_words
            else:
                myquery["MetaFeature"] = {
                    "$regex": f"(^{gene_words}(;|\\|))|^({gene_words})$|(;[\s]*{gene_words}$)"}
        elif keyword != "":
            if category in ["lncrna"]:
                myquery["gene_symbol"] = {
                    "$regex": f"{keyword}", "$options": "i"}
            else:
                myquery["MetaFeature"] = {
                    "$regex": f"{keyword}", "$options": "i"}
        else:
            # filter mRNA's gene column to not empty
            myquery["MetaFeature"] = {"$regex": "^[^?]"}

        if sort_column == "":
            sort_column = "os_exp"
        if sort_dir == "desc":
            sd = -1
        else:
            sd = 1

        if len(fields) > 0: # for download data
            include_fields = {"_id": False}
            for i, j in enumerate(fields):
                include_fields[fields[i]] = True
            results = cur_coll.find(myquery, include_fields).sort(
                sort_column, sd)
        else:
            data = cur_coll.find(myquery).sort(
                sort_column, sd).limit(limit).skip(skip)
            results = {
                "total": cur_coll.count_documents(myquery),
                "data": data
            }

        return results

    # gene頁面搜尋
    def get_logrank_by_gene(category, gene_words, keyword="", limit=10, skip=0, sort_column="", sort_dir="", fields=[], survival_type=""):
        cur_coll = mongo_db["cancer_logrank"]
        check_data = survival_type
        if category in ["methylation450k", "methylation27k"] or survival_type=="" :
            myquery = {
                "category": category,
            }
        else:
            myquery = {
                "category": category,
                "$and":[ {check_data:{"$ne": float('nan')} }, {check_data:{"$ne": "nan"}}, {check_data:{"$ne": "NA"}}, {check_data:{"$ne": ""}}, {check_data:{"$exists": "true"}}]
            }

        if category in ["mirna"]:
            myquery["MetaFeature"] = {"$regex": f"(^{gene_words},)"}
        elif category in ["lncrna"]:
            myquery["gene_symbol"] = gene_words
        else:
            myquery["MetaFeature"] = {
                "$regex": f"(^{gene_words}(;|\\|))|^({gene_words})$|(;[\s]*{gene_words}$)"}

        if keyword != "":
            myquery["type"] = {"$regex": f"{keyword}", "$options": "i"}

        if sort_column == "":
            sort_column = "os_exp"
        if sort_dir == "desc":
            sd = -1
        else:
            sd = 1

        if len(fields) > 0: # for download data
            include_fields = {"_id": False}
            for i, j in enumerate(fields):
                include_fields[fields[i]] = True
            results = cur_coll.find(myquery, include_fields).sort(
                sort_column, sd)
        else:
            data = cur_coll.find(myquery).sort(
                sort_column, sd).limit(limit).skip(skip)
            results = {
                "total": cur_coll.count_documents(myquery),
                "data": data
            }
        
        return results


class CancerAftDataModel():
    def get_aftdata(category, cancer_type, gene="", keyword="", limit=10, skip=0, sort_column="", sort_dir="", fields=[], survival_type=""):
        cur_coll = mongo_db['cancer_aft_wu']
        check_data = survival_type
        if category in ["methylation450k", "methylation27k"] or survival_type=="" :
            myquery = {
                "category": category,
            }
        else:
            myquery = {
                "category": category,
                "$and":[ {check_data:{"$ne": float('nan')} }, {check_data:{"$ne": "nan"}}, {check_data:{"$ne": "NA"}}, {check_data:{"$ne": ""}}, {check_data:{"$exists": "true"}}]
                }
        myquery["type"] = cancer_type

        if gene != "":
            if category in ["mirna"]:
                myquery["MetaFeature"] = {"$regex": f"(^{gene},)"}
            elif category in ["lncrna"]:
                myquery["gene_symbol"] = gene
            else:
                myquery["MetaFeature"] = {
                    "$regex": f"(^{gene}(;|\\|))|^({gene})$|(;[\s]*{gene}$)"}
        elif keyword != "":
            myquery["MetaFeature"] = {"$regex": f"{keyword}", "$options": "i"}
        else:
            # not start with sign ? which indicate ^[^?]
            myquery["MetaFeature"] = {"$regex": "^[^?]"}

        if sort_column == "":
            sort_column = "exp_p_val_OS"
        if sort_dir == "desc":
            sd = -1
        else:
            sd = 1

        if len(fields) > 0: # for download data
            include_fields = {"_id": False}
            for i, j in enumerate(fields):
                include_fields[fields[i]] = True
            results = cur_coll.find(myquery, include_fields).sort(
                sort_column, sd)
        else:
            data = cur_coll.find(myquery).sort(
                sort_column, sd).limit(limit).skip(skip)
            results = {
                "total": cur_coll.count_documents(myquery),
                "data": data
            }
        return results

    # gene頁面搜尋
    def get_aftdata_by_gene(category, gene, keyword="", limit=10, skip=0, sort_column="", sort_dir="", fields=[], survival_type=""):
        cur_coll = mongo_db['cancer_aft_wu']
        check_data = survival_type
        if category in ["methylation450k"] or survival_type=="" :
            myquery = {
                "category": category,
                }
        else:
            myquery = {
                "category": category,
                "$and":[ {check_data:{"$ne": float('nan')} }, {check_data:{"$ne": "nan"}}, {check_data:{"$ne": "NA"}}, {check_data:{"$ne": ""}}, {check_data:{"$exists": "true"}}]
                }

        if category in ["mirna"]:
            myquery["MetaFeature"] = {"$regex": f"(^{gene},)"}
        elif category in ["lncrna"]:
            myquery["gene_symbol"] = gene
        else:
            myquery["MetaFeature"] = {
                "$regex": f"(^{gene}(;|\\|))|^({gene})$|(;[\s]*{gene}$)"}

        if keyword != "":
            myquery["type"] = {"$regex": f"{keyword}", "$options": "i"}

        if sort_column == "":
            sort_column = "exp_p_val_OS"
        if sort_dir == "desc":
            sd = -1
        else:
            sd = 1

        if len(fields) > 0: # for download data
            include_fields = {"_id": False}
            for i, j in enumerate(fields):
                include_fields[fields[i]] = True
            results = cur_coll.find(myquery, include_fields).sort(
                sort_column, sd)
        else:
            data = cur_coll.find(myquery).sort(
                sort_column, sd).limit(limit).skip(skip)
            results = {
                "total": cur_coll.count_documents(myquery),
                "data": data
            }
        return results


class CancerCoxDataModel():
    def get_coxdata(category, cancer_type, gene="", keyword="", limit=10, skip=0, sort_column="", sort_dir="", fields=[], survival_type=""):
        cur_coll = mongo_db['cancer_cox_end']
        check_data = survival_type
        if category in ["methylation27k"] or survival_type=="" :
            myquery = {
                "category": category,
                }
        else:
            myquery = {
                "category": category,
                "$and":[ {check_data:{"$ne": float('nan')} }, {check_data:{"$ne": "nan"}}, {check_data:{"$ne": "NA"}}, {check_data:{"$ne": ""}}, {check_data:{"$exists": "true"}}]
                }
        myquery["type"] = cancer_type

        if gene != "":
            if category in ["mirna"]:
                myquery["MetaFeature"] = {"$regex": f"(^{gene},)"}
            elif category in ["lncrna"]:
                myquery["gene_symbol"] = gene
            else:
                myquery["MetaFeature"] = {
                    "$regex": f"(^{gene}(;|\\|))|^({gene})$|(;[\s]*{gene}$)"}
        elif keyword != "":
            if category in ["lncrna"]:
                myquery["gene_symbol"] = {"$regex": f"(^{gene},)"}
            else:
                myquery["MetaFeature"] = {
                    "$regex": f"{keyword}", "$options": "i"}
        else:
            # not start with sign ? which indicate ^[^?]
            myquery["MetaFeature"] = {"$regex": "^[^?]"}

        if sort_column == "":
            sort_column = "exp_p_val_OS"    

        if sort_dir == "desc":
            sd = -1
        else:
            sd = 1

        if len(fields) > 0: # for download data
            include_fields = {"_id": False}
            for i, j in enumerate(fields):
                include_fields[fields[i]] = True
            results = cur_coll.find(myquery, include_fields).sort(
                sort_column, sd)
        else:
            data = cur_coll.find(myquery).sort(
                sort_column, sd).limit(limit).skip(skip)
            results = {
                "total": cur_coll.count_documents(myquery),
                "data": data
            }
        return results

    # gene頁面搜尋
    def get_coxdata_by_gene(category, gene="", keyword="", limit=10, skip=0, sort_column="", sort_dir="", fields=[], survival_type=""):
        cur_coll = mongo_db['cancer_cox_end']
        check_data = survival_type
        if category in ["methylation450k"] or survival_type=="" :
            myquery = {
                "category": category,
                }
        else:
            myquery = {
                "category": category,
                "$and":[ {check_data:{"$ne": float('nan')} }, {check_data:{"$ne": "nan"}}, {check_data:{"$ne": "NA"}}, {check_data:{"$ne": ""}}, {check_data:{"$exists": "true"}}]
                }
        if category in ["mirna"]:
            myquery["MetaFeature"] = {"$regex": f"(^{gene},)"}
        elif category in ["lncrna"]:
            myquery["gene_symbol"] = gene
        else:
            myquery["MetaFeature"] = {
                "$regex": f"(^{gene}(;|\\|))|^({gene})$|(;[\s]*{gene}$)"}

        if keyword != "":
            myquery["type"] = {"$regex": f"{keyword}", "$options": "i"}

        if sort_column == "":
            sort_column = "exp_p_val_OS"
        if sort_dir == "desc":
            sd = -1
        else:
            sd = 1

        if len(fields) > 0: # for download data
            include_fields = {"_id": False}
            for i, j in enumerate(fields):
                include_fields[fields[i]] = True
            results = cur_coll.find(myquery, include_fields).sort(
                sort_column, sd)
        else:
            data = cur_coll.find(myquery).sort(
                sort_column, sd).limit(limit).skip(skip)
            results = {
                "total": cur_coll.count_documents(myquery),
                "data": data
            }
        return results


class MetaFeatureModel():
    def get_features(category, cancer_type, feature_words, limit=20, skip=0):
        cur_coll = mongo_db["cancer_genome" + category.lower()]
        myquery = {"type": cancer_type, "MetaFeature": {
            "$regex": '^' + feature_words}}
        include_fields = {"MetaFeature": True, "_id": False}
        return cur_coll.find(myquery, include_fields).limit(limit).skip(skip)


class CancerChartDataModel():

    def get_survival(category, cancer_type):
        cur_coll = mongo_db["cancer_survival"]
        myquery = {"type": cancer_type, "days_OS": {"$ne": "NA"}, "vital_status": {
            "$ne": "NA"}, "days_DFS": {"$ne": "NA"}, "DFS_status": {"$ne": "NA"}}
        exclude_fields = {"type": False}
        return cur_coll.find(myquery, exclude_fields)

    def get_genome(category, cancer_type, meta_feature, cgcite):
        # cur_coll = mongo_db[category]
        cur_coll = mongo_db["cancer_genome_" + category.lower()]
        # myquery = { "category": category.lower(), "type": cancer_type, "MetaFeature": meta_feature}
        myquery = {"type": cancer_type, "MetaFeature": meta_feature}
        exclude_fields = {"category": False, "type": False}

        return cur_coll.find(myquery, exclude_fields)

    def get_cancer_dataset(cancer_type):
        cur_coll = mongo_db[cancer_type]
        return cur_coll.find({})


class GenomeDataModel():
    def get(category, name, limit):
        limit = int(limit)

        cur_coll = mongo_db["cancer_genome_" + category.lower()]

        myquery = {}

        if category == "lncrna":
            index = "gene_symbol"
        else:
            index = "MetaFeature"

        myquery[index] = {"$regex": f"^{name}", "$options": "i"}
        include_fields = {index: True, "_id": False}

        data = list(cur_coll.find(myquery, include_fields).distinct(index))
        data = data[:limit]

        return data

    def get_category(gene_words):
        
        category_json = {
            "protein": False, 
            "mirna": False, 
            "mrna": False, 
            "lncrna": False, 
            "methylation27k": False, 
            "methylation450k": False
        }
        cur_coll = mongo_db["cancer_logrank"]
        for category in ["protein", "mirna", "mrna", "lncrna", "methylation27k", "methylation450k"]:
            myquery = {}
            myquery["category"] = category

            index = "MetaFeature"
            if category in ["mirna"]:
                myquery["MetaFeature"] = {"$regex": f"(^{gene_words},)"}
            elif category in ["lncrna"]:
                myquery["gene_symbol"] = gene_words
                index = "gene_symbol"
            else:
                myquery["MetaFeature"] = {
                    "$regex": f"(^{gene_words}(;|\\|))|^({gene_words})$|(;[\s]*{gene_words}$)"}

            
            include_fields = {index: True, "_id": False}
            data = cur_coll.find(myquery, include_fields).limit(1)
            for x in list(data):
                category_json[category] = True
                break
            if category == "mirna" and category_json[category]:
                break
        return category_json

class LogrankDataModel():
    def get(name, category, limit):
        limit = int(limit)

        cur_coll = mongo_db["cancer_logrank"]

        myquery = {}

        
        if category != "":
            index = "MetaFeature"
            myquery["category"] = category
            if category == "lncrna":
                myquery["gene_symbol"] = {
                    "$regex": f"^{name}", "$options": "i"}
                index = "gene_symbol"
            else:
                myquery["MetaFeature"] = {
                    "$regex": f"^{name}", "$options": "i"}

            include_fields = {index: True, "_id": False}
        else:
            myquery = {
                "$or":[{
                    "$and":[ {"MetaFeature":{"$regex": f"^{name}", "$options": "i"} }, {"category":{"$ne": "lncrna"}}]},
                    {"gene_symbol":{"$regex": f"^{name}", "$options": "i"}
                    }]
                            
            }
            include_fields = {"MetaFeature": True, "gene_symbol": True, "_id": False}

        
        data = cur_coll.find(myquery, include_fields).limit(limit)
        return data
