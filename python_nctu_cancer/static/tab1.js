
$(function () {

    // page info
    switch (MY_DATA.selectedCategory) {
        case "protein":
            typeName = "Protein";
            break;
        case "mirna":
            typeName = "miRNA";
            break;
        case "mrna":
            typeName = "mRNA";
            break;
        case "lncrna":
            typeName = "lncRNA";
            break;
    }
    $('.browse-category').html('('+ typeName +')');

    // disable dataTable's warning
    $.fn.dataTable.ext.errMode = 'none';

    fillOption();

    // click sub tab
    $('.nav-sub-tab > li').on('click', function () {
        MY_DATA.selectedTab = $(this).find('a').data("value");

        $(this).siblings("li").removeClass("active");
        $(this).addClass("active");
        if (MY_DATA.selectedGeneValue == "") {
            return;
        }

        showDataTable();
    })

    // search gene
    $('#btn-gene').on("click", function () {
        MY_DATA.selectedCancerType = $('#select-browse-tab').val();
        MY_DATA.selectedGeneValue = $.trim($('.search-gene').val());

        showDataTable();
    })

    // search for the gene names when keying input up
    $('.search-gene').on("keyup", function() {
        let name = $.trim($(this).val());
        if (name == "") {
            $('.search-result').html("");
            return;
        }

        searchGeneNames(name, 100);
    }).on("click", function(e) {
        e.stopPropagation();
        $('.search-result').show();
    })

    // click gene name's search result
    $('.search-result').on("click", "div", function(e) {
        e.stopPropagation();
        $('.search-gene').val($(this).text());
        $(this).parent().hide();
    })

    $('body').on('click', function() {
        $('.search-result').hide();
    })
})

function fillOption() {

    $.ajax({
        url: rootUrl + '/api/category',
        type: "GET",
        dataType: "json",
        data: {
            category: MY_DATA.selectedCategory
        },
        complete: function (data, textStatus, jqXHR) {
        },
        success: function (result, textStatus, jqXHR) {
            var jsonResult = JSON.parse(result);

            if (jsonResult.length > 0) {
                var i, text;

                for (i = 0; i < jsonResult[0].length; i++) {
                    var element = jsonResult[0][i];
                    text = element.name;
                    if (["FFPE Pilot Phase II", "FPPP"].includes(text)) {
                        continue;
                    }
                    if (typeof MY_DATA.cancer_abbr[text] != "undefined") {
                        text = MY_DATA.cancer_abbr[text] + " (" + text + ")";
                    }

                    $('#select-browse-tab').append($('<option>', {
                        value: element.name,
                        text: text
                    }));
                }

                MY_DATA.selectedCancerType = $('#select-browse-tab').val();
            }
        },
        error: function (XMLHttpRequest, textStatus, errorThrown) {
            alert("Status: " + textStatus + "\n"
                + "Error: " + errorThrown);
        }
    });

}

/**
 * show DataTable
 * @returns 
 */
function showDataTable() {
    var url;
    switch (MY_DATA.selectedTab) {
        case "logrank":
            url = rootUrl + '/api/logrank';
            break;
        case "aft":
            url = rootUrl + '/api/aftdata';
            break;
        case "cox":
            url = rootUrl + '/api/coxdata';
            break;
        case "expression":
            url = rootUrl + '/api/logrank';
            break;
        default:
            return;
    }

    var $table = $('<table class="display" width="100%"></table>');

    $('.datatable-box').html("").append($table);

    var dataTable = $table.DataTable({
        sAjaxSource: url,
        fnServerData: function (sSource, aoData, fnCallback) {
            /* Add some extra data to the sender */
            aoData.push({ "name": "sub_tab", "value": MY_DATA.selectedTab });
            retrieveData(sSource, aoData, fnCallback)
        },
        searching: false,
        processing: true,
        serverSide: true,
        bPaginate: true,
        ordering: false,
        sPaginationType: "full_numbers",
        columns: getColumns(MY_DATA.selectedCategory, MY_DATA.selectedCancerType, MY_DATA.selectedTab),
        order: getOrder(MY_DATA.selectedCategory, MY_DATA.selectedCancerType, MY_DATA.selectedTab), // default order
        rowCallback: function (row, data) {
            showRowWarning(row, data, MY_DATA.selectedCategory, MY_DATA.selectedCancerType, MY_DATA.selectedTab);
        },
        dom: 'Bfrtip',
        buttons: [
            'copy', 'csv', 'excel', 'pdf', 'print'
        ],
    });

    // listen dataTable's event
    listenDataTableEvent($table, dataTable, MY_DATA.selectedCategory, MY_DATA.selectedCancerType, MY_DATA.selectedTab);
}

/**
 * listen datatable's event
 * @param {*} $table 
 * @param {*} dataTable 
 * @param {*} category 
 * @param {*} type 
 * @param {*} tab 
 * @returns 
 */
function listenDataTableEvent($table, dataTable, category, type, tab) {
    switch (tab) {
        case "logrank":
            $table.find("tbody").on("click", "tr", function () {
                var survivalType = dataTable.row(this).data()[0];
                var tmpMapping = {
                    "OS": "os",
                    "PFI": "pfi",
                    "DFI": "dfi",
                    "DSS": "dss",
                    "Overall": "os",
                    "Progression-Free": "pfi",
                    "Disease-Free": "dfi",
                    "Disease-Specific": "dss",
                }
                var mode = "os";
                if (typeof tmpMapping[survivalType] != "undefined") {
                    mode = tmpMapping[survivalType];
                }

                MY_DATA.selectedSurvivalType = mode;
                if (["lncrna"].includes(category)) {
                    MY_DATA.selectedMetaFeature = dataTable.row(this).data()[4];
                } else {
                    MY_DATA.selectedMetaFeature = dataTable.row(this).data()[1];
                }
                if (["methylation27k", "methylation450k"].includes(category)) {
                    time = $('#chart-modal-time').val();
                } else {
                    time = $('#chart-time').val();
                }
                drawChart(mode, category, ["methylation27k", "methylation450k"].includes(category));
            })
            break;
        case "aft":
        case "cox":
            $table.find("tbody").on("click", "tr", function () {
                var survivalType = dataTable.row(this).data()[0];
                var tmpMapping = {
                    "OS": "os",
                    "PFI": "pfi",
                    "DFI": "dfi",
                    "DSS": "dss",
                    "Overall": "os",
                    "Progression-Free": "pfi",
                    "Disease-Free": "dfi",
                    "Disease-Specific": "dss",
                }
                var mode = "os";
                if (typeof tmpMapping[survivalType] != "undefined") {
                    mode = tmpMapping[survivalType];
                }

                var index1 = 1, cgcite = "";
                if (["methylation27k", "methylation450k"].includes(category)) {
                    index1 = 2;
                    cgcite = dataTable.row(this).data()[6] || "";
                } else if (["mirna"].includes(category)) {
                    index1 = 1;
                } else if (["lncrna"].includes(category)) {
                    index1 = 6;
                }
                MY_DATA.selectedSurvivalType = mode;
                MY_DATA.selectedMetaFeature = dataTable.row(this).data()[index1];
                MY_DATA.drop_image_columns = [];

                drawNewAftChart(category, tab, MY_DATA.selectedCancerType, MY_DATA.selectedMetaFeature, cgcite, mode);
            })
            break;
        case "expression":
            $table.find("tbody").on("click", "tr", function () {
                MY_DATA.selectedMetaFeature = dataTable.row(this).data()[0];
                drawBoxPlot(MY_DATA.selectedMetaFeature, category);
            })
            break;
        default:
            return;
    }

    let $obj;
    if (["methylation27k", "methylation450k"].includes(category)) {
        $obj = $(".datatable-modal-box div.dataTables_filter input");
    } else {
        $obj = $(".datatable-box div.dataTables_filter input");
    }

    // when click enter to search instead keyup search 
    $obj.unbind().on("keyup", function (e) {
        if (e.keyCode == 13) {
            dataTable.search(this.value).draw();
        }
    });
}

// get and show raw data
function retrieveData(url, aoData, fnCallback) {
    var limit = 10, skip = 0, keyword, colIndex, sortColumn, sortDir, subTab;
    for (var i = 0; i < aoData.length; i++) {
        if (aoData[i]["name"] == "iDisplayStart") {
            skip = aoData[i]["value"];
        } else if (aoData[i]["name"] == "iDisplayLength") {
            limit = aoData[i]["value"];
        } else if (aoData[i]["name"] == "sSearch") {
            keyword = aoData[i]["value"];
        } else if (aoData[i]["name"] == "iSortCol_0") {
            colIndex = aoData[i]["value"];
        } else if (aoData[i]["name"] == "sSortDir_0") {
            sortDir = aoData[i]["value"];
        } else if (aoData[i]["name"] == "sub_tab") {
            subTab = aoData[i]["value"];
        }
    }

    if (MY_DATA.selectedCategory == "" || MY_DATA.selectedCancerType == "" || MY_DATA.selectedGeneValue == "") {
        console.log("empty result")
        return;
    }
    console.log("selectedCategory = " + MY_DATA.selectedCategory + ", selectedCancerType = " + MY_DATA.selectedCancerType + ", subTab = " + subTab)

    sortColumn = getSortColumn(MY_DATA.selectedCategory, MY_DATA.selectedCancerType, subTab, colIndex);
    survival_type = getCheckColumn(MY_DATA.selectedCategory, subTab);

    // hide chart
    $('.shiny-plot-output').hide();

    startLoading();

    $.ajax({
        url: url,
        type: "GET",
        dataType: "json",
        data: {
            category: MY_DATA.selectedCategory,
            type: MY_DATA.selectedCancerType,
            gene: MY_DATA.selectedGeneValue,
            limit: limit,
            skip: skip,
            sort_col: sortColumn,
            sort_dir: sortDir,
            survival_type: survival_type,
        },
        complete: function (data, textStatus, jqXHR) {
            stopLoading();
        },
        success: function (result, textStatus, jqXHR) {
            var data = getCallbackData(result.data, MY_DATA.selectedCategory, MY_DATA.selectedCancerType, subTab);
            fnCallback(data, MY_DATA.selectedCategory, MY_DATA.selectedCancerType, subTab); // 把返回的數據傳給這個方法就可以了,datatable會自動綁定數據的
        },
        error: function (XMLHttpRequest, textStatus, errorThrown) {
            alert("Status: " + textStatus + "\n"
                + "Error: " + errorThrown);
        }
    });
}

/**
 * retrieve modal data
 * @param {*} url 
 * @param {*} aoData 
 * @param {*} fnCallback 
 * @returns 
 */
function retrieveModalData(url, aoData, fnCallback) {
    var limit = 10, skip = 0, keyword, searchCorrelation = 0, sortColumn, sortDir, subTab, colIndex;
    for (var i = 0; i < aoData.length; i++) {
        if (aoData[i]["name"] == "iDisplayStart") {
            skip = aoData[i]["value"];
        } else if (aoData[i]["name"] == "iDisplayLength") {
            limit = aoData[i]["value"];
        } else if (aoData[i]["name"] == "sSearch") {
            keyword = aoData[i]["value"];
        } else if (aoData[i]["name"] == "search_correlation") {
            searchCorrelation = aoData[i]["value"];
        } else if (aoData[i]["name"] == "iSortCol_0") {
            colIndex = aoData[i]["value"];
        } else if (aoData[i]["name"] == "sSortDir_0") {
            sortDir = aoData[i]["value"];
        } else if (aoData[i]["name"] == "sub_tab") {
            subTab = aoData[i]["value"];
        }
    }

    if (MY_DATA.modalCategory == "" || MY_DATA.modalCancerType == "") {
        return;
    }
    console.log("modalCategory = " + MY_DATA.modalCategory + ", modalCancerType = " + MY_DATA.modalCancerType + ", subTab = " + subTab)

    sortColumn = getSortColumn(MY_DATA.modalCategory, MY_DATA.modalCancerType, subTab, colIndex);
    survival_type = getCheckColumn(MY_DATA.selectedCategory, subTab);
    // hide chart
    $('.shiny-plot-output').hide();

    startModalLoading();

    $.ajax({
        url: url,
        type: "GET",
        dataType: "json",
        data: {
            category: MY_DATA.modalCategory,
            type: MY_DATA.modalCancerType,
            gene: MY_DATA.selectedGeneValue,
            entrez: MY_DATA.entrez,
            search_correlation: searchCorrelation,
            limit: limit,
            skip: skip,
            sort_col: sortColumn,
            sort_dir: sortDir,
            survival_type: survival_type,
        },
        complete: function (data, textStatus, jqXHR) {
            stopModalLoading();
        },
        success: function (result, textStatus, jqXHR) {
            if (searchCorrelation == 1) {
                showCustomExpressionTable(result.data);
            }
            var data = getCallbackData(result.data, MY_DATA.modalCategory, MY_DATA.modalCancerType, subTab);
            fnCallback(data); // 把返回的數據傳給這個方法就可以了,datatable會自動綁定數據的
        },
        error: function (XMLHttpRequest, textStatus, errorThrown) {
            alert("Status: " + textStatus + "\n"
                + "Error: " + errorThrown);
        }
    });
}

function chgChartTime(isModal) {
    var category;
    if (isModal) {
        category = MY_DATA.modalCategory;
    } else {
        category = MY_DATA.selectedCategory;
    }

    drawChart(MY_DATA.selectedSurvivalType, category, isModal)
}

/**
 * get sort column by category and subtab etc.
 * @param {*} category 
 * @param {*} type 
 * @param {*} subTab 
 * @param {*} index 
 * @returns 
 */
function getSortColumn(category, type, subTab, index) {
    let mapping = [];
    var suffix = "os";

    switch (subTab) {
        case "logrank":
            mapping.push('MetaFeature');
            if (["methylation27k", "methylation450k"].includes(category)) {
                mapping.push('cgcite');
            }
            mapping.push('MetaFeature');
            if (category == "mirna") {
                mapping.push('MetaFeature');
            } else if (category == "mrna") {
                mapping.push('Entrez');
            }
            if (suffix == 'os') {
                mapping.push("os_exp");
                mapping.push("fdr_os_p");
            } else if (suffix == "pfi") {
                mapping.push("pfi_exp");
                mapping.push("fdr_pfi_p");
            } else if (suffix == "dfi") {
                mapping.push("dfi_exp");
                mapping.push("fdr_dfi_p");
            } else {
                mapping.push("dss_exp");
                mapping.push("fdr_dss_p");
            }
            break;
        case "cox":
        case "aft":
            mapping.push('MetaFeature');
            if (["methylation27k", "methylation450k"].includes(category)) {
                mapping.push('Cgcite');
            }
            mapping.push('MetaFeature');
            if (["mirna", "mrna"].includes(category)) {
                mapping.push('MetaFeature');
            }
            mapping.push('exp_coef_OS');
            mapping.push('exp_p_val_OS');
            mapping.push('fdr_exp_os');
            break;
        case "expression":
            if (["methylation27k", "methylation450k"].includes(category)) {
                mapping.push('cgcite');
            }
            mapping.push('MetaFeature');
            if (category == "mirna") {
                mapping.push('MetaFeature');
            } else if (category == "mrna") {
                mapping.push('MetaFeature');
            }
            mapping.push('normal_exp');
            mapping.push('tumor_exp');
            mapping.push('wilcoxon_p_val');
            break;
    }
    if (typeof mapping[index] != "undefined") {
        return mapping[index];
    } else {
        return mapping[0];
    }
}

function getCheckColumn(category, subTab) {

    switch (subTab) {
        case "logrank":
            checkColumn="os_exp";
            break;
        case "cox":
        case "aft":
            checkColumn = "MetaFeature"
            break;
        case "expression":
            break;
    }

    return checkColumn
}

/**
 * get columns
 * @param {*} category 
 * @param {*} selectedType 
 * @param {*} subTab 
 * @returns 
 */
function getColumns(category, selectedType, subTab) {
    var data = [];

    switch (subTab) {
        case "logrank":
            data.push({ title: 'Survival type' });

            var index = 1;
            var sep = "|";
            if (["methylation27k", "methylation450k"].includes(category)) {
                data.push({ title: 'CpG site' });
                index = 2;
            } else if (category == "mirna") {
                sep = ",";
            }
            data.push({
                title: 'Gene', render: function (data, type, row, meta) {
                    var tmp = row[index].split(sep);
                    return tmp[0];
                }
            });
            if (category == "mirna") {
                data.push({
                    title: "miRBASE ID", render: function (data, type, row, meta) {
                        var tmp = row[index].split(sep);
                        return tmp[1];
                    }
                });
            } else if (category == "mrna") {
                data.push({
                    title: "Entrez ID", render: function (data, type, row, meta) {
                        var tmp = row[index].split(sep);
                        return tmp[1];
                    }
                });
            }
            data.push({ title: 'P-val' });
            data.push({ title: 'Adjusted P-val' });

            if (category == "mrna") {
                if (MY_DATA.methylation27kTypes.includes(selectedType)) {
                    data.push({
                        title: "",
                        render: function (data, type, row, meta) {
                            var tmpFeatures = row[1].split("|");
                            return '<input type="button" value="27k" class="methylation-btn" onclick="showModal(event, \'methylation27k\', \'' + tmpFeatures[0] + '\', \'' + tmpFeatures[1] + '\')" />';
                        }
                    });
                }
                data.push({
                    title: "",
                    render: function (data, type, row, meta) {
                        var tmpFeatures = row[1].split("|");
                        return '<input type="button" value="450k" class="methylation-btn" onclick="showModal(event, \'methylation450k\', \'' + tmpFeatures[0] + '\', \'' + tmpFeatures[1] + '\')" />';
                    }
                });
            }
            break;
        case "cox":
        case "aft":
            if (category == "mrna") {
                data = [
                    {
                        title: "Survival type"
                    },
                    {
                        title: "Gene", render: function (data, type, row, meta) {
                            var tmp = row[1].split("|");
                            return tmp[0];
                        }
                    },
                    {
                        title: "EntrezID", render: function (data, type, row, meta) {
                            var tmp = row[1].split("|");
                            return tmp.length > 1 ? tmp[1] : "";
                        }
                    },
                    {
                        title: "Coefficient", render: function (data, type, row, meta) {
                            return row[2];
                        }
                    },
                    {
                        title: "P-val", render: function (data, type, row, meta) {
                            return row[3];
                        }
                    },
                    {
                        title: "Adjusted P-val", render: function (data, type, row, meta) {
                            return row[4];
                        }
                    },
                ];
                if (MY_DATA.methylation27kTypes.includes(selectedType)) {
                    data.push({
                        title: "",
                        render: function (data, type, row, meta) {
                            var tmpFeatures = row[1].split("|");
                            return '<input type="button" value="27k" class="methylation-btn" onclick="showModal(event, \'methylation27k\', \'' + tmpFeatures[0] + '\', \'' + tmpFeatures[1] + '\')" />';
                        }
                    })
                }
                data.push({
                    title: "",
                    render: function (data, type, row, meta) {
                        var tmpFeatures = row[1].split("|");
                        return '<input type="button" value="450k" class="methylation-btn" onclick="showModal(event, \'methylation450k\', \'' + tmpFeatures[0] + '\', \'' + tmpFeatures[1] + '\')" />';
                    }
                })
            } else {
                data.push({ title: 'Survival type' });
                if (["methylation27k", "methylation450k"].includes(category)) {
                    data.push({ title: 'CpG site' });
                }
                data.push({ title: 'Gene', render: function (data, type, row, meta) {
                        if (["mirna"].includes(category)) {
                            return data.split(",")[0];
                        } else {
                            return data;
                        }
                    }
                });
                if (["mirna"].includes(category)) {
                    data.push({ 
                        title: 'miRBASE', render: function (data, type, row, meta) {
                            return data.split(",")[1];
                        }
                    });
                }
                data.push({ title: 'Coefficient' });
                data.push({ title: 'P-val' });
                data.push({ title: 'Adjusted P-val' });
            }
            break;
        case "expression":
            if (["methylation27k", "methylation450k"].includes(category)) {
                data.push({ title: 'Cgcite' });
            }

            var sep = "|";
            if (category == "mirna") {
                sep = ",";
            }
            data.push({ title: 'Gene',
                render: function (data, type, row, meta) {
                    return data.split(sep)[0];
                }
            });
            if (category == "mirna") {
                data.push({ title: 'miRBASE ID',
                    render: function (data, type, row, meta) {
                        return row[0].split(sep)[1];
                    }
                });
            } else if (category == "mrna") {
                data.push({ title: 'Entrez ID' });
            }
            data.push({
                title: 'Expression (Normal)'
            });
            data.push({
                title: 'Expression (Tumor)'
            });
            data.push({
                title: 'Wilcoxon P-val'
            });

            if (category == "mrna") {
                if (MY_DATA.methylation27kTypes.includes(selectedType)) {
                    data.push({
                        title: "",
                        render: function (data, type, row, meta) {
                            var tmpFeatures = row[1].split("|");
                            return '<input type="button" value="27k" class="methylation-btn" onclick="showModal(event, \'methylation27k\', \'' + row[0] + '\', \'' + row[1] + '\')" />';
                        }
                    });
                }
                data.push({
                    title: "",
                    render: function (data, type, row, meta) {
                        var tmpFeatures = row[1].split("|");
                        return '<input type="button" value="450k" class="methylation-btn" onclick="showModal(event, \'methylation450k\', \'' + row[0] + '\', \'' + row[1] + '\')" />';
                    }
                });
            }
            break;
    }

    return data;
}

/**
 * 取得order結果
 * @param {*} category 
 * @param {*} type 
 * @param {*} subTab 
 */
function getOrder(category, type, subTab) {
    return [[0, 'asc']];
}

/**
 * 顯示警告列標示
 * @param {*} row 
 * @param {*} data 
 * @param {*} category 
 * @param {*} type 
 * @param {*} subTab 
 */
function showRowWarning(row, data, category, type, subTab) {
    switch (subTab) {
        case "logrank":
            let index = 3;
            if (["methylation27k", "methylation450k", "mirna", "mrna"].includes(category)) {
                index = 4;
            }
            if (parseFloat(data[index]) < 0.05) {
                $(row).addClass('row-warning-red');
            }
            break;
        case "cox":
            var index1 = 4, index2 = 2;
            if (["methylation27k", "methylation450k", "mirna"].includes(category)) {
                index1 = 5;
                index2 = 3;
            }

            if (parseFloat(data[index1]) < 0.05) {
                if (parseFloat(data[index2]) > 0) {
                    $(row).addClass('row-warning-red');
                } else {
                    $(row).addClass('row-warning-green');
                }
            }
            break;
        case "aft":
            var index1 = 4, index2 = 2;
            if (["methylation27k", "methylation450k", "mirna"].includes(category)) {
                index1 = 5;
                index2 = 3;
            }

            if (parseFloat(data[index1]) < 0.05) {
                if (parseFloat(data[index2]) > 0) {
                    $(row).addClass('row-warning-green');
                } else {
                    $(row).addClass('row-warning-red');
                }
            }
            break;
    }
}

/**
 * 取得callback組成資料a
 * @param {*} data 
 * @param {*} category 
 * @param {*} type 
 * @param {*} subTab 
 * @returns 
 */
function getCallbackData(data, category, type, subTab) {
    var details = [];

    function _get(data, category, type, subTab, keyIndex) {
        var tmpKeys = [];

        switch (subTab) {
            case "logrank":
                tmpKeys.push("");

                if (["methylation27k", "methylation450k"].includes(category)) {
                    tmpKeys.push("cgcite");
                }
                if (category == "lncrna") {
                    tmpKeys.push("gene_symbol");
                } else {
                    tmpKeys.push("MetaFeature");
                }
                if (["mirna", "mrna"].includes(category)) {
                    tmpKeys.push("MetaFeature");
                }

                if (keyIndex == 0) {
                    tmpKeys.push("os_exp");
                    tmpKeys.push("fdr_os_p");
                } else if (keyIndex == 1) {
                    tmpKeys.push("pfi_exp");
                    tmpKeys.push("fdr_pfi_p");
                } else if (keyIndex == 2) {
                    tmpKeys.push("dfi_exp");
                    tmpKeys.push("fdr_dfi_p");
                } else {
                    tmpKeys.push("dss_exp");
                    tmpKeys.push("fdr_dss_p");
                }
                tmpKeys.push("MetaFeature");
                break;
            case "cox":
            case "aft":
                tmpKeys.push("");

                if (["methylation27k", "methylation450k"].includes(category)) {
                    tmpKeys.push("Cgcite");
                }
                if (category == "lncrna") {
                    tmpKeys.push("gene_symbol");
                } else {
                    tmpKeys.push("MetaFeature");
                }
                if (category == "mirna") {
                    tmpKeys.push("MetaFeature");
                }

                if (keyIndex == 0) {
                    tmpKeys.push("exp_coef_OS");
                    tmpKeys.push("exp_p_val_OS");
                    tmpKeys.push("fdr_exp_os");
                } else if (keyIndex == 1) {
                    tmpKeys.push("exp_coef_PFI");
                    tmpKeys.push("exp_p_val_PFI");
                    tmpKeys.push("fdr_exp_pfi");
                } else if (keyIndex == 2) {
                    tmpKeys.push("exp_coef_DFI");
                    tmpKeys.push("exp_p_val_DFI");
                    tmpKeys.push("fdr_exp_dfi");
                } else {
                    tmpKeys.push("exp_coef_DSS");
                    tmpKeys.push("exp_p_val_DSS");
                    tmpKeys.push("fdr_exp_dss");
                }

                tmpKeys.push("cgcite");
                tmpKeys.push("MetaFeature");
                break;
            case "expression":
                if (["methylation27k", "methylation450k"].includes(category)) {
                    tmpKeys.push("cgcite");
                }
                if (category == "lncrna") {
                    tmpKeys.push("gene_symbol");
                } else {
                    tmpKeys.push("MetaFeature");
                }
                if (category == "mirna") {
                    tmpKeys.push("gene");
                } else if (category == "mrna") {
                    tmpKeys.push("Entrez");
                }
                tmpKeys.push("normal_exp");
                tmpKeys.push("tumor_exp");
                tmpKeys.push("wilcoxon_p_val");
                tmpKeys.push("MetaFeature");
                break;
        }

        var d = [];
        for (var i = 0; i < tmpKeys.length; i++) {
            // survival type
            if (i == 0 && ["logrank", "cox", "aft"].includes(subTab) ) {
                if (keyIndex == 0) {
                    d.push("Overall");
                } else if (keyIndex == 1) {
                    d.push("Progression-Free");
                } else if (keyIndex == 2) {
                    d.push("Disease-Free");
                } else {
                    d.push("Disease-Specific");
                }
                continue;
            }

            // 忽略大小寫
            var val = data[Object.keys(data).find(key => key.toLowerCase() === tmpKeys[i].toLowerCase())];
            if (typeof val == "undefined" || ["", "NA", "NAN"].includes(val)) {
                if (tmpKeys[i].toLowerCase() === "cgcite") {
                    d.push("");
                } else {
                    d.push("-");
                }
            } else {
                d.push(val);
            }
        }
        return d;
    }

    for (var i in data.d) {
        details.push(_get(data.d[i], category, type, subTab, 0));
        if (["logrank", "cox", "aft"].includes(subTab)) {
            details.push(_get(data.d[i], category, type, subTab, 1));
            details.push(_get(data.d[i], category, type, subTab, 2));
            details.push(_get(data.d[i], category, type, subTab, 3));
        }
    }

    var result = {
        "sEcho": "test",
        "iTotalRecords": data["total"],
        "iTotalDisplayRecords": data["total"],
        "aaData": details,
    };

    return result;
}


/**
 * search for the gene names
 * @param {*} name 
 * @param {*} limit 
 * @returns 
 */
function searchGeneNames(name, limit) {
    
    $.ajax({
        url: rootUrl + '/api/logrank/name',
        type: "GET",
        dataType: "json",
        data: {
            name: name,
            limit: limit,
            category: MY_DATA.selectedCategory
        },
        complete: function (data, textStatus, jqXHR) {
        },
        success: function (result, textStatus, jqXHR) {
            if (result.status == "success") {
                showGeneSearchResult(result.data);
            } else {
                console.log(result.message || "error");
            }
        },
        error: function (XMLHttpRequest, textStatus, errorThrown) {
            console.log("Error: " + XMLHttpRequest);
        }
    });
}

/**
 * Show search dropdown list result
 * @param {*} $obj 
 * @param {*} data 
 * @returns 
 */
function showGeneSearchResult(data) {
    let i, htmls = [];
    for (i = 0; i < data.length; i ++) {
        htmls.push('<div>' + data[i] + '</div>');
    }

    if (htmls.length == 0) {
        $('.search-result').html('').hide();
        return;
    }

    let $html = $(htmls.join(''));

    $('.search-result').html($html).show();
}

function startModalLoading() {
    if (MY_DATA.loadingModalFlag == 0) {
        $(".modal").loading();
        $('.loading-overlay-content').html('<img src="' + rootUrl + '/static/images/loading.gif" /> Loading...');
    }

    MY_DATA.loadingModalFlag++;
}

function stopModalLoading() {
    MY_DATA.loadingModalFlag--;

    if (MY_DATA.loadingModalFlag <= 0) {
        MY_DATA.loadingModalFlag = 0;
        $(".modal").loading("stop");
    }
}
