import sys
import traceback
import pandas as pd
import json
import plotly as py
from python_nctu_cancer.TwoGene import TwoGene

if __name__ == '__main__':
    response = {'status': 'SUCCESS'}
    try:
        category1 = sys.argv[1]
        category2 = sys.argv[2]
        mode = sys.argv[3]
        gene1 = sys.argv[4]
        gene2 = sys.argv[5]
        cancer_type = sys.argv[6]
        group1 = sys.argv[7].split(",")
        group2 = sys.argv[8].split(",")
        time = sys.argv[9]

        two_gene = TwoGene()
        response = two_gene.get_img_data(category1, category2, mode, gene1, gene2, cancer_type, group1, group2, time)
    except ValueError as err:
        response['status'] = 'FAILED'
        response['message'] = traceback.format_exc()
        # print(traceback.format_exc())

    print(json.dumps(response, cls = py.utils.PlotlyJSONEncoder))
