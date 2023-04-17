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

    // click browse button
    $(".type-btn").click(function (e) {
        MY_DATA.selectedCancerType = $('#select-browse-tab1').val();
        showDataTable();
    });

    // click sub tab
    $('.nav-sub-tab > li').on('click', function () {
        MY_DATA.selectedTab = $(this).find('a').data("value");

        $(this).siblings("li").removeClass("active");
        $(this).addClass("active");

        // show or hide survival type
        if (MY_DATA.selectedTab == "expression") {
            $(this).parent().next(".tab-content").find('.survival_type').hide();
        } else {
            $(this).parent().next(".tab-content").find('.survival_type').show();
        }

        showDataTable();
    })

    // click OS, PFI, DFI, DSS
    $('[name="browse-mode"]').on("click", function () {
        showDataTable();
    })
    $('[name="browse-modal-mode"]').on("click", function () {
        showModalDataTable();
    })

    // download data
    $(".download-data").on('click', function() {
        var category, type, tab, mode, sortCol, sortDir, gene = "";
        if ($(this).attr("id") == "download-btn2") {
            category = MY_DATA.modalCategory;
            type = MY_DATA.modalCancerType;
            mode = $('[name="browse-modal-mode"]:checked').val();
            tab = MY_DATA.modalTab;
            gene = MY_DATA.methylationGene;
            sortCol = getSortColumn(category, type, tab, MY_DATA.modalDataTable.order()[0][0]);
            sortDir = MY_DATA.modalDataTable.order()[0][1];
        } else {
            category = MY_DATA.selectedCategory;
            type = MY_DATA.selectedCancerType;
            mode = $('[name="browse-mode"]:checked').val();
            tab = MY_DATA.selectedTab;
            sortCol = getSortColumn(category, type, tab, MY_DATA.dataTable.order()[0][0]);
            sortDir = MY_DATA.dataTable.order()[0][1];
        }

        var link = '';
        switch (tab) {
            case "logrank":
            case "expression":
                link = rootUrl + "/api/logrank/download";
                break;
            case "cox":
                link = rootUrl + "/api/coxdata/download";
                break;
            case "aft":
                link = rootUrl + "/api/aftdata/download";
                break;
            default:
                return;
        }

        $('#downloadForm input').remove();

        $('#downloadForm').append('<input type="hidden" name="category" value="' + category + '" >');
        $('#downloadForm').append('<input type="hidden" name="type" value="' + type + '" >');
        $('#downloadForm').append('<input type="hidden" name="mode" value="' + mode + '" >');
        $('#downloadForm').append('<input type="hidden" name="tab" value="' + tab + '" >');
        $('#downloadForm').append('<input type="hidden" name="sort_col" value="' + sortCol + '" >');
        $('#downloadForm').append('<input type="hidden" name="sort_dir" value="' + sortDir + '" >');
        $('#downloadForm').append('<input type="hidden" name="gene" value="' + gene + '" >');

        $('#downloadForm').attr("action", link);
        $('#downloadForm').submit();
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

                    $('#select-browse-tab1').append($('<option>', {
                        value: element.name,
                        text: text
                    }));
                }

                MY_DATA.selectedCancerType = $('#select-browse-tab1').val();

                // init click
                $('.nav-sub-tab > li').eq(0).trigger("click");
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
        searching: true,
        processing: true,
        serverSide: true,
        bPaginate: true,
        sPaginationType: "full_numbers",
        columns: getColumns(MY_DATA.selectedCategory, MY_DATA.selectedCancerType, MY_DATA.selectedTab),
        order: getOrder(MY_DATA.selectedCategory, MY_DATA.selectedCancerType, MY_DATA.selectedTab), // default order
        rowCallback: function (row, data) {
            showRowWarning(row, data, MY_DATA.selectedCategory, MY_DATA.selectedCancerType, MY_DATA.selectedTab);
        },
        dom: 'Bfrtip',
        buttons: [
            // 'copy', 'csv', 'excel', 'pdf', 'print'
        ],
    });

    MY_DATA.dataTable = dataTable;

    // listen dataTable's event
    listenDataTableEvent($table, dataTable, MY_DATA.selectedCategory, MY_DATA.selectedCancerType, MY_DATA.selectedTab);
}

/**
 * show modal's DataTable
 * @param {*} e 
 * @param {*} category 
 * @param {*} gene 
 * @returns 
 */
function showModal(e, category, gene, entrez) {
    e.stopPropagation();

    MY_DATA.modalCategory = category;
    MY_DATA.modalCancerType = MY_DATA.selectedCancerType;
    MY_DATA.modalTab = "logrank";
    MY_DATA.methylationGene = gene;
    MY_DATA.entrez = entrez;
    $('#tbl-browse-modal').modal("show");

    if (category == "methylation27k") {
        $('#tbl-browse-modal .modal-title').text('methylation 27k');
    } else {
        $('#tbl-browse-modal .modal-title').text('methylation 450k');
    }

    // reset tab
    $('#nav-browse-modal li').removeClass("active").eq(0).addClass("active");
    MY_DATA.modalTab = 'logrank';

    showModalDataTable();

    // tab click event
    $("#nav-browse-modal li").unbind("click").on('click', function () {
        MY_DATA.modalTab = $(this).find('a').data("value");

        $(this).siblings("li").removeClass("active");
        $(this).addClass("active");

        // show or hide survival type
        if (MY_DATA.modalTab == "expression") {
            $(this).parent().next(".tab-content").find('.survival_type').hide();
        } else {
            $(this).parent().next(".tab-content").find('.survival_type').show();
        }

        showModalDataTable();
    })
}

function showModalDataTable() {
    var url;

    switch (MY_DATA.modalTab) {
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

    $('.datatable-modal-box').html("").append($table);

    var dataTable = $table.DataTable({
        sAjaxSource: url,
        fnServerData: function (sSource, aoData, fnCallback) {
            /* Add some extra data to the sender */
            if (MY_DATA.modalTab == "expression") {
                aoData.push({ "name": "search_correlation", "value": 1 });
            }
            aoData.push({ "name": "sub_tab", "value": MY_DATA.modalTab });
            retrieveModalData(sSource, aoData, fnCallback);
        },
        searching: false,
        processing: true,
        serverSide: true,
        bPaginate: true,
        sPaginationType: "full_numbers",
        columns: getColumns(MY_DATA.modalCategory, MY_DATA.modalCancerType, MY_DATA.modalTab),
        order: getOrder(MY_DATA.modalCategory, MY_DATA.modalCancerType, MY_DATA.modalTab), // default order
        rowCallback: function (row, data) {
            showRowWarning(row, data, MY_DATA.modalCategory, MY_DATA.modalCancerType, MY_DATA.modalTab);
        },
        dom: 'Bfrtip',
        buttons: [
            // 'copy', 'csv', 'excel', 'pdf', 'print'
        ],
    });

    MY_DATA.modalDataTable = dataTable;

    // listen dataTable's event
    listenDataTableEvent($table, dataTable, MY_DATA.modalCategory, MY_DATA.modalCancerType, MY_DATA.modalTab);
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
                if (["methylation27k", "methylation450k"].includes(category)) {
                    MY_DATA.selectedMetaFeature = dataTable.row(this).data()["Cgcite"];
                    chartIndex = 1;

                    mode = $('[name="browse-modal-mode"]:checked').val();
                    category = MY_DATA.modalCategory;
                } else {
                    MY_DATA.selectedMetaFeature = dataTable.row(this).data()["MetaFeature"];
                    chartIndex = 0;

                    mode = $('[name="browse-mode"]:checked').val();
                    category = MY_DATA.selectedCategory;
                }
                drawChart(mode, category, ["methylation27k", "methylation450k"].includes(category));
            })
            break;
        case "aft":
        case "cox":
            $table.find("tbody").on("click", "tr", function () {
                MY_DATA.selectedMetaFeature = dataTable.row(this).data()["MetaFeature"];
                cgcite = dataTable.row(this).data()["Cgcite"] || "";
                MY_DATA.drop_image_columns = [];

                var survivalType;
                if (["methylation27k", "methylation450k"].includes(category)) {
                    survivalType = $('[name="browse-modal-mode"]:checked').val();
                } else {
                    survivalType = $('[name="browse-mode"]:checked').val();
                }
                drawNewAftChart(category, tab, MY_DATA.selectedCancerType, MY_DATA.selectedMetaFeature, cgcite, survivalType);
            })
            break;
        case "expression":
            $table.find("tbody").on("click", "tr", function () {
                if (["lncrna"].includes(category)) {
                    MY_DATA.selectedMetaFeature = dataTable.row(this).data()["gene_symbol"];
                } else if (["methylation27k", "methylation450k"].includes(category)) {
                    MY_DATA.selectedMetaFeature = dataTable.row(this).data()["Cgcite"];
                } else {
                    MY_DATA.selectedMetaFeature = dataTable.row(this).data()["MetaFeature"];
                }
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

    if (MY_DATA.selectedCategory == "" || MY_DATA.selectedCancerType == "") {
        console.log("empty result " + MY_DATA.selectedCategory + ", " + MY_DATA.selectedCancerType)
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
            tab: subTab,
            keyword: keyword,
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
    survival_type = getCheckColumn(MY_DATA.modalCategory, subTab);

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
            tab: subTab,
            gene: MY_DATA.methylationGene,
            entrez: MY_DATA.entrez,
            search_correlation: searchCorrelation,
            keyword: keyword,
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
    var category, mode;
    if (isModal) {
        mode = $('[name="browse-modal-mode"]:checked').val();
        category = MY_DATA.modalCategory;
    } else {
        mode = $('[name="browse-mode"]:checked').val();
        category = MY_DATA.selectedCategory;
    }

    drawChart(mode, category, isModal)
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
    var suffix;
    if (["methylation27k", "methylation450k"].includes(category)) {
        suffix = $('[name="browse-modal-mode"]:checked').val();
    } else {
        suffix = $('[name="browse-mode"]:checked').val();
    }
    var upperSuffix = suffix.toUpperCase();

    switch (subTab) {
        case "logrank":
            if (["methylation27k", "methylation450k"].includes(category)) {
                mapping.push('Cgcite');
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
            if (["methylation27k", "methylation450k"].includes(category)) {
                mapping.push('Cgcite');
            }
            mapping.push('MetaFeature');
            if (["mirna", "mrna"].includes(category)) {
                mapping.push('Entrez');
            }else if (category == "mrna") {
                mapping.push('MetaFeature');
            }
            mapping.push('exp_coef_' + upperSuffix);
            mapping.push('exp_p_val_' + upperSuffix);
            mapping.push('fdr_exp_' + suffix);
            break;
        case "expression":
            if (["methylation27k", "methylation450k"].includes(category)) {
                mapping.push('cgcite');
            }
            mapping.push('MetaFeature');
            if (category == "mirna") {
                mapping.push('MetaFeature');
            } else if (category == "mrna") {
                mapping.push('Entrez');
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

    var suffix;
    if (["methylation27k", "methylation450k"].includes(category)) {
        suffix = $('[name="browse-modal-mode"]:checked').val();
    } else {
        suffix = $('[name="browse-mode"]:checked').val();
    }

    switch (subTab) {
        case "logrank":
            if (suffix == 'os') {
                checkColumn="os_exp";
            } else if (suffix == "pfi") {
                checkColumn="pfi_exp";
            } else if (suffix == "dfi") {
                checkColumn="pfi_exp";
            } else {
                checkColumn="pfi_exp";
            }
            break;
        case "cox":
        case "aft":
            if (suffix == 'os') {
                checkColumn = "exp_p_val_OS"
            } else if (suffix == "pfi") {
                checkColumn = "exp_p_val_PFI"
            } else if (suffix == "dfi") {
                checkColumn = "exp_p_val_DFI"
            } else {
                checkColumn = "exp_p_val_DSS"
            }
            break;
        case "expression":
                checkColumn="os_exp";
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
    var results = [];
    var suffix;

    if (["methylation27k", "methylation450k"].includes(category)) {
        suffix = $('[name="browse-modal-mode"]:checked').val();
    } else {
        suffix = $('[name="browse-mode"]:checked').val();
    }
    var upperSuffix = suffix.toUpperCase();

    switch (subTab) {
        case "logrank":
            var sep = "|";
            if (["methylation27k", "methylation450k"].includes(category)) {
                results.push({
                    title: 'CpG site',
                    render: function (data, type, row, meta) {
                        return row["Cgcite"];
                    }
                });
            } else if (category == "mirna") {
                sep = ",";
            }
            results.push({
                title: 'Gene',
                render: function (data, type, row, meta) {
                    if (category == "lncrna") {
                        return row["gene_symbol"];
                    } else {
                        return row["MetaFeature"].split(sep)[0];
                    }
                }
            });
            if (category == "mirna") {
                results.push({
                    data: "MetaFeature",
                    title: "miRBASE ID",
                    render: function (data, type, row, meta) {
                        var tmp = data.split(sep);
                        return tmp[1];
                    }
                });
            } else if (category == "mrna") {
                results.push({
                    title: "Entrez ID",
                    render: function (data, type, row, meta) {
                        return row["Entrez"];
                    }
                });
            }
            results.push({ data: suffix + "_exp", title: 'P-val (' + upperSuffix + ')' });
            results.push({ data: "fdr_" + suffix + "_p", title: 'Adjusted P-val (' + upperSuffix + ')' });

            if (category == "mrna") {
                if (MY_DATA.methylation27kTypes.includes(selectedType)) {
                    results.push({
                        title: "",
                        render: function (data, type, row, meta) {
                            var tmpFeatures = row["MetaFeature"].split("|");
                            return '<input type="button" value="27k" class="methylation-btn" onclick="showModal(event, \'methylation27k\', \'' + tmpFeatures[0] + '\', \'' + tmpFeatures[1] + '\')" />';
                        }
                    });
                }
                results.push({
                    title: "",
                    render: function (data, type, row, meta) {
                        var tmpFeatures = row["MetaFeature"].split("|");
                        return '<input type="button" value="450k" class="methylation-btn" onclick="showModal(event, \'methylation450k\', \'' + tmpFeatures[0] + '\', \'' + tmpFeatures[1] + '\')" />';
                    }
                });
            }
            break;
        case "cox":
        case "aft":
            if (category == "mrna") {
                results = [
                    {
                        title: "Gene",
                        render: function (data, type, row, meta) {
                            var tmp = row["MetaFeature"].split("|");
                            return tmp[0];
                        }
                    },
                    {
                        data: "MetaFeature",
                        title: "EntrezID",
                        render: function (data, type, row, meta) {
                            var tmp = data.split("|");
                            return tmp.length > 1 ? tmp[1] : "";
                        }
                    },
                    {
                        title: "Coefficient (" + upperSuffix + ")",
                        render: function (data, type, row, meta) {
                            if ("exp_coef_" + upperSuffix in row) {
                                return row["exp_coef_" + upperSuffix];
                            } else {
                                return "-";
                            }
                        }
                    },
                    {
                        title: "P-val (" + upperSuffix + ")",
                        render: function (data, type, row, meta) {
                            if ("exp_p_val_" + upperSuffix in row) {
                                return row["exp_p_val_" + upperSuffix];
                            } else {
                                return "-";
                            }
                        }
                    },
                    {
                        data: "fdr_exp_" + suffix,
                        title: "Adjusted P-val (" + upperSuffix + ")",
                        render: function (data, type, row, meta) {
                            if ("fdr_exp_" + suffix in row) {
                                return row["fdr_exp_" + suffix];
                            } else {
                                return "-";
                            }
                        }
                    },
                ];
                if (MY_DATA.methylation27kTypes.includes(selectedType)) {
                    results.push({
                        title: "",
                        render: function (data, type, row, meta) {
                            var tmpFeatures = row["MetaFeature"].split("|");
                            return '<input type="button" value="27k" class="methylation-btn" onclick="showModal(event, \'methylation27k\', \'' + tmpFeatures[0] + '\', \'' + tmpFeatures[1] + '\')" />';
                        }
                    });
                }
                results.push({
                    title: "",
                    render: function (data, type, row, meta) {
                        var tmpFeatures = row["MetaFeature"].split("|");
                        return '<input type="button" value="450k" class="methylation-btn" onclick="showModal(event, \'methylation450k\', \'' + tmpFeatures[0] + '\', \'' + tmpFeatures[1] + '\')" />';
                    }
                })
            } else {
                if (["methylation27k", "methylation450k"].includes(category)) {
                    results.push({
                        title: 'CpG site',
                        render: function (data, type, row, meta) {
                            return row["Cgcite"];
                        }
                    });
                }
                results.push({
                    title: 'Gene', render: function (data, type, row, meta) {
                        if (["mirna"].includes(category)) {
                            return row["MetaFeature"].split(",")[0];
                        } else if (["lncrna"].includes(category)) {
                            return row["gene_symbol"];
                        } else {
                            return row["MetaFeature"];
                        }
                    }
                });
                if (["mirna"].includes(category)) {
                    results.push({
                        data: "MetaFeature",
                        title: 'miRBASE ID',
                        render: function (data, type, row, meta) {
                            return data.split(",")[1];
                        }
                    });
                }
                results.push({ 
                    title: 'Coefficient (' + upperSuffix + ')',
                    render: function (data, type, row, meta) {
                        if ("exp_coef_" + upperSuffix in row) {
                            return row["exp_coef_" + upperSuffix];
                        } else {
                            return "-";
                        }
                    }
                });
                results.push({
                    title: 'P-val (' + upperSuffix + ')',
                    render: function (data, type, row, meta) {
                        if ("exp_p_val_" + upperSuffix in row) {
                            return row["exp_p_val_" + upperSuffix];
                        } else {
                            return "-";
                        }
                    }
                });
                results.push({
                    title: 'Adjusted P-val (' + upperSuffix + ')',
                    render: function (data, type, row, meta) {
                        if ("fdr_exp_" + suffix in row) {
                            return row["fdr_exp_" + suffix];
                        } else {
                            return "-";
                        }
                    }
                });
            }
            break;
        case "expression":
            sep = "|";
            if (category == "mirna") {
                sep = ",";
            }
            if (["methylation27k", "methylation450k"].includes(category)) {
                results.push({ 
                    title: 'CpG site',
                    render: function (data, type, row, meta) {
                        return row["Cgcite"];
                    }
                });
            }

            results.push({
                title: 'Gene',
                render: function (data, type, row, meta) {
                    if (category == "lncrna") {
                        return row["gene_symbol"];
                    } else {
                        return row["MetaFeature"].split(sep)[0];
                    }
                }
            });
            if (category == "mirna") {
                results.push({
                    data: "MetaFeature",
                    title: "miRBASE ID",
                    render: function (data, type, row, meta) {
                        var tmp = data.split(sep);
                        return tmp[1];
                    }
                });
            } else if (category == "mrna") {
                results.push({
                    data: "Entrez",
                    title: 'Entrez ID'
                });
            }
            results.push({
                title: 'Expression (Normal)',
                render: function (data, type, row, meta) {
                    if ("normal_exp" in row) {
                        return row["normal_exp"];
                    } else {
                        return "-";
                    }
                }
            });
            results.push({
                title: 'Expression (Tumor)',
                render: function (data, type, row, meta) {
                    if ("tumor_exp" in row) {
                        return row["tumor_exp"];
                    } else {
                        return "-";
                    }
                }
            });
            results.push({
                title: 'Wilcoxon P-val',
                render: function (data, type, row, meta) {
                    if ("wilcoxon_p_val" in row) {
                        return row["wilcoxon_p_val"];
                    } else {
                        return "-";
                    }
                }
            });

            if (category == "mrna") {
                if (MY_DATA.methylation27kTypes.includes(selectedType)) {
                    results.push({
                        title: "",
                        render: function (data, type, row, meta) {
                            var tmpFeatures = row["MetaFeature"].split("|");
                            return '<input type="button" value="27k" class="methylation-btn" onclick="showModal(event, \'methylation27k\', \'' + tmpFeatures[0] + '\', \'' + tmpFeatures[1] + '\')" />';
                        }
                    });
                }
                results.push({
                    title: "",
                    render: function (data, type, row, meta) {
                        var tmpFeatures = row["MetaFeature"].split("|");
                        return '<input type="button" value="450k" class="methylation-btn" onclick="showModal(event, \'methylation450k\', \'' + tmpFeatures[0] + '\', \'' + tmpFeatures[1] + '\')" />';
                    }
                });
            }
            break;
    }

    return results;
}

/**
 * 取得order結果
 * @param {*} category 
 * @param {*} type 
 * @param {*} subTab 
 */
function getOrder(category, type, subTab) {
    switch (subTab) {
        case "logrank":
            if (["mirna", "mrna", "methylation27k", "methylation450k"].includes(category)) {
                return [[2, 'asc']];
            } else if (["protein", "lncrna"].includes(category)) {
                return [[1, 'asc']];
            }
            break;
        case "cox":
        case "aft":
            if (["mirna", "mrna", "methylation27k", "methylation450k"].includes(category)) {
                return [[3, 'asc']];
            } else if (["protein", "lncrna"].includes(category)) {
                return [[2, 'asc']];
            }
            break;
        case "expression":
            return [[0, 'asc']];
    }

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
    var suffix;

    if (["methylation27k", "methylation450k"].includes(category)) {
        suffix = $('[name="browse-modal-mode"]:checked').val();
    } else {
        suffix = $('[name="browse-mode"]:checked').val();
    }
    switch (subTab) {
        case "logrank":
            var index = 'fdr_' + suffix + "_p";
            if (parseFloat(data[index]) < 0.05) {
                $(row).addClass('row-warning-red');
            }
            break;
        case "cox":
            var index1 = "fdr_exp_" + suffix.toLowerCase(),
                index2 = "exp_coef_" + suffix.toUpperCase();

            if (parseFloat(data[index1]) < 0.05) {
                if (parseFloat(data[index2]) > 0) {
                    $(row).addClass('row-warning-red');
                } else {
                    $(row).addClass('row-warning-green');
                }
            }
            break;
        case "aft":
            var index1 = "fdr_exp_" + suffix.toLowerCase(),
                index2 = "exp_coef_" + suffix.toUpperCase();

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
    for (var i = 0; i < data["d"].length; i++) {
        for (var j in data["d"][i]) {
            // 忽略大小寫
            var val = $.trim(data["d"][i][j]);
            if (typeof val == "undefined" || ["", "NA", "NAN"].includes(val)) {
                if (j.toLowerCase() === "cgcite") {
                    data["d"][i][j] = "";
                } else {
                    data["d"][i][j] = "-";
                }
            }
        }
    }

    var result = {
        "sEcho": "test",
        "iTotalRecords": data["total"],
        "iTotalDisplayRecords": data["total"],
        "aaData": data["d"],
    };

    return result;
}

/**
 * Show current expression's custom table, prepare to click button and show correlation chart
 * @param {*} result
 */
function showCustomExpressionTable(result) {
    var htmls = [], i, val1, val2, val3, val4;

    htmls.push('<div>');
    htmls.push('<table class="correlationTable">');
    htmls.push('<tr>');
    htmls.push('<th></th>');
    htmls.push('<th>Cgsite</th>');
    htmls.push('<th>Pearson cor</th>');
    htmls.push('<th>Pearson P-val</th>');
    htmls.push('<th>Spearman cor</th>');
    htmls.push('<th>Spearman P-val</th>');
    htmls.push('</tr>')
    for (i = 0; i < result["d"].length; i++) {
        val1 = "";
        val2 = "";
        val3 = "";
        val4 = "";
        if (typeof result["correlations"][i] != "undefined" && result["correlations"][i] != "") {
            val1 = result["correlations"][i][0];
            val2 = result["correlations"][i][1];
            val3 = result["correlations"][i][2];
            val4 = result["correlations"][i][3];
        }

        htmls.push('<tr>');
        htmls.push('<td><input type="checkbox" /></td>');
        htmls.push('<td>' + result["d"][i]["Cgcite"] + '</td>');
        htmls.push('<td>' + val1 + '</td>');
        htmls.push('<td>' + val2 + '</td>');
        htmls.push('<td>' + val3 + '</td>');
        htmls.push('<td>' + val4 + '</td>');
        htmls.push('</tr>')
    }
    htmls.push('</table>');

    htmls.push('<div><input type="button" class="correlation-btn" value="Start" /></div>');
    htmls.push('</div>');

    $('#table-browse-modal').html(htmls.join(''))
        .show();

    // click correlation start
    $('#table-browse-modal .correlation-btn').on('click', function () {
        var data = {
            category: MY_DATA.modalCategory,
            type: MY_DATA.modalCancerType,
            feature: MY_DATA.methylationGene,
            entrez: MY_DATA.entrez,
        };

        var cgcites = [];
        $('#table-browse-modal .correlationTable input[type="checkbox"]').each(function (index) {
            if (!$(this).is(":checked")) {
                return;
            }
            cgcites.push(result["d"][index]["Cgcite"]);
        })

        if (cgcites.length == 0) {
            alert("Please select a row.");
            return;
        }

        data["cgcites"] = cgcites.join(",");
        drawCorrelationChart(data)
    })
}

function drawCorrelationChart(data) {
    try {
        startModalLoading();

        $.ajax({
            url: rootUrl + '/api/correlation',
            type: "GET",
            dataType: "json",
            data: data,
            complete: function (data, textStatus, jqXHR) {
                stopModalLoading();
            },
            success: function (result, textStatus, jqXHR) {
                if (result.status == "success") {
                    $('#chart2-browse-modal').show();
                    $('#chart2-browse-modal').html(result["data"]["correlations"].join(""));
                } else {
                    alert(result.message || "error");
                }
            },
            error: function (XMLHttpRequest, textStatus, errorThrown) {
                alert("Error: " + XMLHttpRequest);
            }
        });
    } catch (e) {

    }
}

// function startLoading() {
//     if (MY_DATA.loadingFlag == 0) {
//         $("body").loading();
//         $('.loading-overlay-content').html('<img src="' + rootUrl + '/static/images/loading.gif" /> Loading...');
//     }

//     MY_DATA.loadingFlag++;
// }

// function stopLoading() {
//     MY_DATA.loadingFlag--;

//     if (MY_DATA.loadingFlag <= 0) {
//         MY_DATA.loadingFlag = 0;
//         $("body").loading("stop");
//     }
// }

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

// function downloadChart(category, type, feature, mode, L_per, H_per) {
//     window.open(rootUrl + '/api/chart/download?category=' + category + '&type=' + type + '&feature=' + feature + '&mode=' + mode + '&L_per=' + L_per + '&H_per=' + H_per);
// }

// function downloadAftPlot(category, type, feature, cgcite, survivalType) {
//     window.open(rootUrl + '/api/aftplot/download?category=' + category + '&type=' + type + '&feature=' + feature + '&cgcite=' + cgcite + '&survival_type=' + survivalType);
// }