
var selectedGeneCategory = ''
var selectedCancerType = ''
var selectedMetaFeature = ''
var selectedGene = '';
var loadingFlag = 0

// Sub Charts

var dataSrc = {};

$(function () {

    // click OS, PFI, DFI, DSS
    $('.browse-gene-radio').on("click", function () {
        var subTab = "";
        $('.tab-gent-content > div').each(function (index) {
            if ($(this).hasClass("active")) {
                subTab = $(this).find(".nav-select-gene").val()
            }
        })

        selectedGeneCategory = $(this).attr("name").split("-")[2]

        reloadGeneDataTableAjax(selectedGeneCategory, subTab);

    })

    // change chart width or color
    $('.chart-gene-option-color1, .chart-gene-option-width1, .chart-gene-option-color2, .chart-gene-option-width2, .chart-gene-option-marker-color1, .chart-gene-option-marker-color2').on("change", function () {
        if (MY_DATA.chartJsonResult["chart_data"] && MY_DATA.chartJsonResult["chart_data"][0]["chart1_data"]) {
            showGeneChart();
        }
    })

    // Page 2 Tables
    proteinDataTable2 = $('#tbl-gene-protein-logrank').DataTable({
        sAjaxSource: rootUrl + '/api/logrank',
        fnServerData: function (sSource, aoData, fnCallback) {
            /* Add some extra data to the sender */
            aoData.push({ "name": "sub_category", "value": "protein" });
            aoData.push({ "name": "sub_tab", "value": "logrank" });
            retrieveGeneData(sSource, aoData, fnCallback)
        },
        searching: true,
        processing: true,
        serverSide: true,
        bPaginate: true,
        sPaginationType: "full_numbers",
        columns: getGeneColumns("protein", "", "logrank"),
        order: [[0, 'asc']], // default order
        rowCallback: function (row, data) {
            if (parseFloat(data[3]) < 0.05) {
                $(row).addClass('row-warning-red');
            }
        },
        dom: 'Bfrtip',
        buttons: [
            // 'copy', 'csv', 'excel', 'pdf', 'print'
        ],
    });

    proteinAftDataTable2 = $('#tbl-gene-protein-aft').DataTable({
        sAjaxSource: rootUrl + '/api/aftdata',
        fnServerData: function (sSource, aoData, fnCallback) {
            /* Add some extra data to the sender */
            aoData.push({ "name": "sub_category", "value": "protein" });
            aoData.push({ "name": "sub_tab", "value": "aft" });
            retrieveGeneData(sSource, aoData, fnCallback)
        },
        searching: true,
        processing: true,
        serverSide: true,
        bPaginate: true,
        sPaginationType: "full_numbers",
        columns: getGeneColumns("protein", "", "aft"),
        order: [[0, 'asc']], // default order
        rowCallback: function (row, data) {
            if (parseFloat(data[4]) < 0.05) {
                if (parseFloat(data[2]) > 0) {
                    $(row).addClass('row-warning-green');
                } else {
                    $(row).addClass('row-warning-red');
                }
            }
        },
        dom: 'Bfrtip',
        buttons: [
            // 'copy', 'csv', 'excel', 'pdf', 'print'
        ],
    });

    proteinCoxDataTable2 = $('#tbl-gene-protein-cox').DataTable({
        sAjaxSource: rootUrl + '/api/coxdata',
        fnServerData: function (sSource, aoData, fnCallback) {
            /* Add some extra data to the sender */
            aoData.push({ "name": "sub_category", "value": "protein" });
            aoData.push({ "name": "sub_tab", "value": "cox" });
            retrieveGeneData(sSource, aoData, fnCallback)
        },
        searching: true,
        processing: true,
        serverSide: true,
        bPaginate: true,
        sPaginationType: "full_numbers",
        columns: getGeneColumns("protein", "", "cox"),
        order: [[0, 'asc']], // default order
        rowCallback: function (row, data) {
            if (parseFloat(data[4]) < 0.05) {
                if (parseFloat(data[2]) > 0) {
                    $(row).addClass('row-warning-red');
                } else {
                    $(row).addClass('row-warning-green');
                }
            }
        },
        dom: 'Bfrtip',
        buttons: [
            // 'copy', 'csv', 'excel', 'pdf', 'print'
        ],
    });

    proteinExpDataTable2 = $('#tbl-gene-protein-expression').DataTable({
        sAjaxSource: rootUrl + '/api/logrank',
        fnServerData: function (sSource, aoData, fnCallback) {
            /* Add some extra data to the sender */
            aoData.push({ "name": "sub_category", "value": "protein" });
            aoData.push({ "name": "sub_tab", "value": "expression" });
            retrieveGeneData(sSource, aoData, fnCallback)
        },
        searching: true,
        processing: true,
        serverSide: true,
        bPaginate: true,
        sPaginationType: "full_numbers",
        columns: getGeneColumns("protein", "", "expression"),
        rowCallback: function (row, data) {
        },
        dom: 'Bfrtip',
        buttons: [
            // 'copy', 'csv', 'excel', 'pdf', 'print'
        ],
    });

    miRNADataTable2 = $('#tbl-gene-mirna-logrank').DataTable({
        sAjaxSource: rootUrl + '/api/logrank',
        fnServerData: function (sSource, aoData, fnCallback) {
            /* Add some extra data to the sender */
            aoData.push({ "name": "sub_category", "value": "mirna" });
            aoData.push({ "name": "sub_tab", "value": "logrank" });
            retrieveGeneData(sSource, aoData, fnCallback)
        },
        searching: true,
        processing: true,
        serverSide: true,
        bPaginate: true,
        sPaginationType: "full_numbers",
        columns: getGeneColumns("mirna", "", "logrank"),
        order: [[0, 'asc']], // default order
        rowCallback: function (row, data) {
            if (parseFloat(data[4]) < 0.05) {
                $(row).addClass('row-warning-red');
            }
        },
        dom: 'Bfrtip',
        buttons: [
            // 'copy', 'csv', 'excel', 'pdf', 'print'
        ],
    });

    miRNAAftDataTable2 = $('#tbl-gene-mirna-aft').DataTable({
        sAjaxSource: rootUrl + '/api/aftdata',
        fnServerData: function (sSource, aoData, fnCallback) {
            /* Add some extra data to the sender */
            aoData.push({ "name": "sub_category", "value": "mirna" });
            aoData.push({ "name": "sub_tab", "value": "aft" });
            retrieveGeneData(sSource, aoData, fnCallback)
        },
        searching: true,
        processing: true,
        serverSide: true,
        bPaginate: true,
        sPaginationType: "full_numbers",
        columns: getGeneColumns("mirna", "", "aft"),
        order: [[0, 'asc']], // default order
        rowCallback: function (row, data) {
            if (parseFloat(data[5]) < 0.05) {
                if (parseFloat(data[3]) > 0) {
                    $(row).addClass('row-warning-green');
                } else {
                    $(row).addClass('row-warning-red');
                }
            }
        },
        dom: 'Bfrtip',
        buttons: [
            // 'copy', 'csv', 'excel', 'pdf', 'print'
        ],
    });

    miRNACoxDataTable2 = $('#tbl-gene-mirna-cox').DataTable({
        sAjaxSource: rootUrl + '/api/coxdata',
        fnServerData: function (sSource, aoData, fnCallback) {
            /* Add some extra data to the sender */
            aoData.push({ "name": "sub_category", "value": "mirna" });
            aoData.push({ "name": "sub_tab", "value": "cox" });
            retrieveGeneData(sSource, aoData, fnCallback)
        },
        searching: true,
        processing: true,
        serverSide: true,
        bPaginate: true,
        sPaginationType: "full_numbers",
        columns: getGeneColumns("mirna", "", "cox"),
        order: [[0, 'asc']], // default order
        rowCallback: function (row, data) {
            if (parseFloat(data[5]) < 0.05) {
                if (parseFloat(data[3]) > 0) {
                    $(row).addClass('row-warning-red');
                } else {
                    $(row).addClass('row-warning-green');
                }
            }
        },
        dom: 'Bfrtip',
        buttons: [
            // 'copy', 'csv', 'excel', 'pdf', 'print'
        ],
    });

    miRNAExpDataTable2 = $('#tbl-gene-mirna-expression').DataTable({
        sAjaxSource: rootUrl + '/api/logrank',
        fnServerData: function (sSource, aoData, fnCallback) {
            /* Add some extra data to the sender */
            aoData.push({ "name": "sub_category", "value": "mirna" });
            aoData.push({ "name": "sub_tab", "value": "expression" });
            retrieveGeneData(sSource, aoData, fnCallback)
        },
        searching: true,
        processing: true,
        serverSide: true,
        bPaginate: true,
        sPaginationType: "full_numbers",
        columns: getGeneColumns("mirna", "", "expression"),
        rowCallback: function (row, data) {
        },
        dom: 'Bfrtip',
        buttons: [
            // 'copy', 'csv', 'excel', 'pdf', 'print'
        ],
    });

    mRNADataTable2 = $('#tbl-gene-mrna-logrank').DataTable({
        sAjaxSource: rootUrl + '/api/logrank',
        fnServerData: function (sSource, aoData, fnCallback) {
            /* Add some extra data to the sender */
            aoData.push({ "name": "sub_category", "value": "mrna" });
            aoData.push({ "name": "sub_tab", "value": "logrank" });
            retrieveGeneData(sSource, aoData, fnCallback)
        },
        searching: true,
        processing: true,
        serverSide: true,
        bPaginate: true,
        sPaginationType: "full_numbers",
        columns: getGeneColumns("mrna", "", "logrank"),
        order: [[0, 'asc']], // default order
        rowCallback: function (row, data) {
            if (parseFloat(data[4]) < 0.05) {
                $(row).addClass('row-warning-red');
            }
        },
        dom: 'Bfrtip',
        buttons: [
            // 'copy', 'csv', 'excel', 'pdf', 'print'
        ],
    });

    mRNAAftDataTable2 = $('#tbl-gene-mrna-aft').DataTable({
        sAjaxSource: rootUrl + '/api/aftdata',
        fnServerData: function (sSource, aoData, fnCallback) {
            /* Add some extra data to the sender */
            aoData.push({ "name": "sub_category", "value": "mrna" });
            aoData.push({ "name": "sub_tab", "value": "aft" });
            retrieveGeneData(sSource, aoData, fnCallback)
        },
        searching: true,
        processing: true,
        serverSide: true,
        bPaginate: true,
        sPaginationType: "full_numbers",
        columns: getGeneColumns("mrna", "", "aft"),
        order: [[0, 'asc']], // default order
        rowCallback: function (row, data) {
            if (parseFloat(data[4]) < 0.05) {
                if (parseFloat(data[2]) > 0) {
                    $(row).addClass('row-warning-green');
                } else {
                    $(row).addClass('row-warning-red');
                }
            }
        },
        dom: 'Bfrtip',
        buttons: [
            // 'copy', 'csv', 'excel', 'pdf', 'print'
        ],
    });

    mRNACoxDataTable2 = $('#tbl-gene-mrna-cox').DataTable({
        sAjaxSource: rootUrl + '/api/coxdata',
        fnServerData: function (sSource, aoData, fnCallback) {
            /* Add some extra data to the sender */
            aoData.push({ "name": "sub_category", "value": "mrna" });
            aoData.push({ "name": "sub_tab", "value": "cox" });
            retrieveGeneData(sSource, aoData, fnCallback)
        },
        searching: true,
        processing: true,
        serverSide: true,
        bPaginate: true,
        sPaginationType: "full_numbers",
        columns: getGeneColumns("mrna", "", "cox"),
        order: [[0, 'asc']], // default order
        rowCallback: function (row, data) {
            if (parseFloat(data[4]) < 0.05) {
                if (parseFloat(data[2]) > 0) {
                    $(row).addClass('row-warning-red');
                } else {
                    $(row).addClass('row-warning-green');
                }
            }
        },
        dom: 'Bfrtip',
        buttons: [
            // 'copy', 'csv', 'excel', 'pdf', 'print'
        ],
    });

    mRNAExpDataTable2 = $('#tbl-gene-mrna-expression').DataTable({
        sAjaxSource: rootUrl + '/api/logrank',
        fnServerData: function (sSource, aoData, fnCallback) {
            /* Add some extra data to the sender */
            aoData.push({ "name": "sub_category", "value": "mrna" });
            aoData.push({ "name": "sub_tab", "value": "expression" });
            retrieveGeneData(sSource, aoData, fnCallback)
        },
        searching: true,
        processing: true,
        serverSide: true,
        bPaginate: true,
        sPaginationType: "full_numbers",
        columns: getGeneColumns("mrna", "", "expression"),
        rowCallback: function (row, data) {
        },
        dom: 'Bfrtip',
        buttons: [
            // 'copy', 'csv', 'excel', 'pdf', 'print'
        ],
    });

    methylation27kDataTable2 = $('#tbl-gene-methylation27k-logrank').DataTable({
        sAjaxSource: rootUrl + '/api/logrank',
        fnServerData: function (sSource, aoData, fnCallback) {
            /* Add some extra data to the sender */
            aoData.push({ "name": "sub_category", "value": "methylation27k" });
            aoData.push({ "name": "sub_tab", "value": "logrank" });
            retrieveGeneData(sSource, aoData, fnCallback)
        },
        searching: true,
        processing: true,
        serverSide: true,
        bPaginate: true,
        sPaginationType: "full_numbers",
        columns: getGeneColumns("methylation27k", "", "logrank"),
        order: [[0, 'asc']], // default order
        rowCallback: function (row, data) {
            if (parseFloat(data[4]) < 0.05) {
                $(row).addClass('row-warning-red');
            }
        },
        dom: 'Bfrtip',
        buttons: [
            // 'copy', 'csv', 'excel', 'pdf', 'print'
        ],
    });

    methylation27kAftDataTable2 = $('#tbl-gene-methylation27k-aft').DataTable({
        sAjaxSource: rootUrl + '/api/aftdata',
        fnServerData: function (sSource, aoData, fnCallback) {
            /* Add some extra data to the sender */
            aoData.push({ "name": "sub_category", "value": "methylation27k" });
            aoData.push({ "name": "sub_tab", "value": "aft" });
            retrieveGeneData(sSource, aoData, fnCallback)
        },
        searching: true,
        processing: true,
        serverSide: true,
        bPaginate: true,
        sPaginationType: "full_numbers",
        columns: getGeneColumns("methylation27k", "", "aft"),
        order: [[0, 'asc']], // default order
        rowCallback: function (row, data) {
            if (parseFloat(data[5]) < 0.05) {
                if (parseFloat(data[3]) > 0) {
                    $(row).addClass('row-warning-green');
                } else {
                    $(row).addClass('row-warning-red');
                }
            }
        },
        dom: 'Bfrtip',
        buttons: [
            // 'copy', 'csv', 'excel', 'pdf', 'print'
        ],
    });

    methylation27kCoxDataTable2 = $('#tbl-gene-methylation27k-cox').DataTable({
        sAjaxSource: rootUrl + '/api/coxdata',
        fnServerData: function (sSource, aoData, fnCallback) {
            /* Add some extra data to the sender */
            aoData.push({ "name": "sub_category", "value": "methylation27k" });
            aoData.push({ "name": "sub_tab", "value": "cox" });
            retrieveGeneData(sSource, aoData, fnCallback)
        },
        searching: true,
        processing: true,
        serverSide: true,
        bPaginate: true,
        sPaginationType: "full_numbers",
        columns: getGeneColumns("methylation27k", "", "cox"),
        order: [[0, 'asc']], // default order
        rowCallback: function (row, data) {
            if (parseFloat(data[5]) < 0.05) {
                if (parseFloat(data[3]) > 0) {
                    $(row).addClass('row-warning-red');
                } else {
                    $(row).addClass('row-warning-green');
                }
            }
        },
        dom: 'Bfrtip',
        buttons: [
            // 'copy', 'csv', 'excel', 'pdf', 'print'
        ],
    });

    methylation27kExpDataTable2 = $('#tbl-gene-methylation27k-expression').DataTable({
        sAjaxSource: rootUrl + '/api/logrank',
        fnServerData: function (sSource, aoData, fnCallback) {
            /* Add some extra data to the sender */
            aoData.push({ "name": "sub_category", "value": "methylation27k" });
            aoData.push({ "name": "sub_tab", "value": "expression" });
            retrieveGeneData(sSource, aoData, fnCallback)
        },
        searching: true,
        processing: true,
        serverSide: true,
        bPaginate: true,
        sPaginationType: "full_numbers",
        columns: getGeneColumns("methylation27k", "", "expression"),
        rowCallback: function (row, data) {
        },
        dom: 'Bfrtip',
        buttons: [
            // 'copy', 'csv', 'excel', 'pdf', 'print'
        ],
    });

    methylation450kDataTable2 = $('#tbl-gene-methylation450k-logrank').DataTable({
        sAjaxSource: rootUrl + '/api/logrank',
        fnServerData: function (sSource, aoData, fnCallback) {
            /* Add some extra data to the sender */
            aoData.push({ "name": "sub_category", "value": "methylation450k" });
            aoData.push({ "name": "sub_tab", "value": "logrank" });
            retrieveGeneData(sSource, aoData, fnCallback)
        },
        searching: true,
        processing: true,
        serverSide: true,
        bPaginate: true,
        sPaginationType: "full_numbers",
        columns: getGeneColumns("methylation450k", "", "logrank"),
        order: [[0, 'asc']], // default order
        rowCallback: function (row, data) {
            if (parseFloat(data[4]) < 0.05) {
                $(row).addClass('row-warning-red');
            }
        },
        dom: 'Bfrtip',
        buttons: [
            // 'copy', 'csv', 'excel', 'pdf', 'print'
        ],
    });

    methylation450kAftDataTable2 = $('#tbl-gene-methylation450k-aft').DataTable({
        sAjaxSource: rootUrl + '/api/aftdata',
        fnServerData: function (sSource, aoData, fnCallback) {
            /* Add some extra data to the sender */
            aoData.push({ "name": "sub_category", "value": "methylation450k" });
            aoData.push({ "name": "sub_tab", "value": "aft" });
            retrieveGeneData(sSource, aoData, fnCallback)
        },
        searching: true,
        processing: true,
        serverSide: true,
        bPaginate: true,
        sPaginationType: "full_numbers",
        columns: getGeneColumns("methylation450k", "", "aft"),
        order: [[0, 'asc']], // default order
        rowCallback: function (row, data) {
            if (parseFloat(data[5]) < 0.05) {
                if (parseFloat(data[3]) > 0) {
                    $(row).addClass('row-warning-green');
                } else {
                    $(row).addClass('row-warning-red');
                }
            }
        },
        dom: 'Bfrtip',
        buttons: [
            // 'copy', 'csv', 'excel', 'pdf', 'print'
        ],
    });

    methylation450kCoxDataTable2 = $('#tbl-gene-methylation450k-cox').DataTable({
        sAjaxSource: rootUrl + '/api/coxdata',
        fnServerData: function (sSource, aoData, fnCallback) {
            /* Add some extra data to the sender */
            aoData.push({ "name": "sub_category", "value": "methylation450k" });
            aoData.push({ "name": "sub_tab", "value": "cox" });
            retrieveGeneData(sSource, aoData, fnCallback)
        },
        searching: true,
        processing: true,
        serverSide: true,
        bPaginate: true,
        sPaginationType: "full_numbers",
        columns: getGeneColumns("methylation450k", "", "cox"),
        order: [[0, 'asc']], // default order
        rowCallback: function (row, data) {
            if (parseFloat(data[5]) < 0.05) {
                if (parseFloat(data[3]) > 0) {
                    $(row).addClass('row-warning-red');
                } else {
                    $(row).addClass('row-warning-green');
                }
            }
        },
        dom: 'Bfrtip',
        buttons: [
            // 'copy', 'csv', 'excel', 'pdf', 'print'
        ],
    });

    methylation450kExpDataTable2 = $('#tbl-gene-methylation450k-expression').DataTable({
        sAjaxSource: rootUrl + '/api/logrank',
        fnServerData: function (sSource, aoData, fnCallback) {
            /* Add some extra data to the sender */
            aoData.push({ "name": "sub_category", "value": "methylation450k" });
            aoData.push({ "name": "sub_tab", "value": "expression" });
            retrieveGeneData(sSource, aoData, fnCallback)
        },
        searching: true,
        processing: true,
        serverSide: true,
        bPaginate: true,
        sPaginationType: "full_numbers",
        columns: getGeneColumns("methylation450k", "", "expression"),
        rowCallback: function (row, data) {
        },
        dom: 'Bfrtip',
        buttons: [
            // 'copy', 'csv', 'excel', 'pdf', 'print'
        ],
    });

    // lncrna DataTable 2
    lncrnaDataTable2 = $('#tbl-gene-lncrna-logrank').DataTable({
        sAjaxSource: rootUrl + '/api/logrank',
        fnServerData: function (sSource, aoData, fnCallback) {
            /* Add some extra data to the sender */
            aoData.push({ "name": "sub_category", "value": "lncrna" });
            aoData.push({ "name": "sub_tab", "value": "logrank" });
            retrieveGeneData(sSource, aoData, fnCallback)
        },
        searching: true,
        processing: true,
        serverSide: true,
        bPaginate: true,
        sPaginationType: "full_numbers",
        columns: getGeneColumns("lncrna", "", "logrank"),
        order: [[0, 'asc']], // default order
        rowCallback: function (row, data) {
            if (parseFloat(data[3]) < 0.05) {
                $(row).addClass('row-warning-red');
            }
        },
        dom: 'Bfrtip',
        buttons: [
            // 'copy', 'csv', 'excel', 'pdf', 'print'
        ],
    });

    lncrnaAftDataTable2 = $('#tbl-gene-lncrna-aft').DataTable({
        sAjaxSource: rootUrl + '/api/aftdata',
        fnServerData: function (sSource, aoData, fnCallback) {
            /* Add some extra data to the sender */
            aoData.push({ "name": "sub_category", "value": "lncrna" });
            aoData.push({ "name": "sub_tab", "value": "aft" });
            retrieveGeneData(sSource, aoData, fnCallback)
        },
        searching: true,
        processing: true,
        serverSide: true,
        bPaginate: true,
        sPaginationType: "full_numbers",
        columns: getGeneColumns("lncrna", "", "aft"),
        order: [[0, 'asc']], // default order
        rowCallback: function (row, data) {
            if (parseFloat(data[4]) < 0.05) {
                if (parseFloat(data[2]) > 0) {
                    $(row).addClass('row-warning-green');
                } else {
                    $(row).addClass('row-warning-red');
                }
            }
        },
        dom: 'Bfrtip',
        buttons: [
            // 'copy', 'csv', 'excel', 'pdf', 'print'
        ],
    });

    lncrnaCoxDataTable2 = $('#tbl-gene-lncrna-cox').DataTable({
        sAjaxSource: rootUrl + '/api/coxdata',
        fnServerData: function (sSource, aoData, fnCallback) {
            /* Add some extra data to the sender */
            aoData.push({ "name": "sub_category", "value": "lncrna" });
            aoData.push({ "name": "sub_tab", "value": "cox" });
            retrieveGeneData(sSource, aoData, fnCallback)
        },
        searching: true,
        processing: true,
        serverSide: true,
        bPaginate: true,
        sPaginationType: "full_numbers",
        columns: getGeneColumns("lncrna", "", "cox"),
        order: [[0, 'asc']], // default order
        rowCallback: function (row, data) {
            if (parseFloat(data[4]) < 0.05) {
                if (parseFloat(data[2]) > 0) {
                    $(row).addClass('row-warning-red');
                } else {
                    $(row).addClass('row-warning-green');
                }
            }
        },
        dom: 'Bfrtip',
        buttons: [
            // 'copy', 'csv', 'excel', 'pdf', 'print'
        ],
    });

    lncrnaExpDataTable2 = $('#tbl-gene-lncrna-expression').DataTable({
        sAjaxSource: rootUrl + '/api/logrank',
        fnServerData: function (sSource, aoData, fnCallback) {
            /* Add some extra data to the sender */
            aoData.push({ "name": "sub_category", "value": "lncrna" });
            aoData.push({ "name": "sub_tab", "value": "expression" });
            retrieveGeneData(sSource, aoData, fnCallback)
        },
        searching: true,
        processing: true,
        serverSide: true,
        bPaginate: true,
        sPaginationType: "full_numbers",
        columns: getGeneColumns("lncrna", "", "expression"),
        rowCallback: function (row, data) {
        },
        dom: 'Bfrtip',
        buttons: [
            // 'copy', 'csv', 'excel', 'pdf', 'print'
        ],
    });

    /**
     * click log rank table tr
     */
    $('#tbl-gene-protein-logrank tbody, #tbl-gene-mirna-logrank tbody, #tbl-gene-mrna-logrank tbody, #tbl-gene-lncrna-logrank tbody, #tbl-gene-methylation27k-logrank tbody, #tbl-gene-methylation450k-logrank tbody').on('click', 'tr', function () {
        var category;
        switch ($(this).parent().parent().attr("id")) {
            case "tbl-gene-protein-logrank":
                category = "protein";
                paramType = proteinDataTable2.row(this).data()[proteinDataTable2.row(this).data().length - 2];
                paramMetaFeature = proteinDataTable2.row(this).data()[1];
                break;
            case "tbl-gene-mirna-logrank":
                category = "mirna";
                paramType = miRNADataTable2.row(this).data()[miRNADataTable2.row(this).data().length - 2];
                paramMetaFeature = miRNADataTable2.row(this).data()[1];
                break;
            case "tbl-gene-mrna-logrank":
                category = "mrna";
                paramType = mRNADataTable2.row(this).data()[mRNADataTable2.row(this).data().length - 2];
                paramMetaFeature = mRNADataTable2.row(this).data()[1];
                break;
            case "tbl-gene-lncrna-logrank":
                category = "lncrna";
                paramType = lncrnaDataTable2.row(this).data()[lncrnaDataTable2.row(this).data().length - 2];
                paramMetaFeature = lncrnaDataTable2.row(this).data()[lncrnaDataTable2.row(this).data().length - 1];
                break;
            case "tbl-gene-methylation450k-logrank":
                category = "methylation450k";
                paramType = methylation450kDataTable2.row(this).data()[methylation450kDataTable2.row(this).data().length - 2];
                paramMetaFeature = methylation450kDataTable2.row(this).data()[1];
                break;
            case "tbl-gene-methylation27k-logrank":
                category = "methylation27k";
                paramType = methylation27kDataTable2.row(this).data()[methylation27kDataTable2.row(this).data().length - 2];
                paramMetaFeature = methylation27kDataTable2.row(this).data()[1];
                break;
            default:
                return;
        }

        // clear chart
        $('.shiny-plot-output').hide();
        if (paramMetaFeature == "") {
            alert("Please select a feature");
        } else {
            MY_DATA.selectedCategory = category;
            MY_DATA.selectedCancerType = paramType;
            MY_DATA.selectedMetaFeature = paramMetaFeature;
            let time = $('#chart-time').val();
            drawSubChart(category, paramType, paramMetaFeature, time);
        }
    });

    /**
     * click Cox table's tr
     */
    $('#tbl-gene-protein-cox tbody, #tbl-gene-mirna-cox tbody, #tbl-gene-mrna-cox tbody, #tbl-gene-lncrna-cox tbody, #tbl-gene-methylation27k-cox tbody, #tbl-gene-methylation450k-cox tbody').on('click', 'tr', function () {
        var category = "", type = "", cgcite = "";
        switch ($(this).parent().parent().attr("id")) {
            case "tbl-gene-protein-cox":
                category = "protein";
                type = proteinCoxDataTable2.row(this).data()[7];
                selectedMetaFeature = proteinCoxDataTable2.row(this).data()[8];
                break;
            case "tbl-gene-mirna-cox":
                category = "mirna";
                type = miRNACoxDataTable2.row(this).data()[7];
                selectedMetaFeature = miRNACoxDataTable2.row(this).data()[8];
                break;
            case "tbl-gene-mrna-cox":
                category = "mrna";
                type = mRNACoxDataTable2.row(this).data()[7];
                selectedMetaFeature = mRNACoxDataTable2.row(this).data()[8];
                break;
            case "tbl-gene-lncrna-cox":
                category = "lncrna";
                type = lncrnaCoxDataTable2.row(this).data()[7];
                selectedMetaFeature = lncrnaCoxDataTable2.row(this).data()[8];
                break;
            case "tbl-gene-methylation450k-cox":
                category = "methylation450k";
                cgcite = methylation450kCoxDataTable2.row(this).data()[6];
                type = methylation450kCoxDataTable2.row(this).data()[7];
                selectedMetaFeature = methylation450kCoxDataTable2.row(this).data()[8];
                break;
            case "tbl-gene-methylation27k-cox":
                category = "methylation27k";
                cgcite = methylation27kCoxDataTable2.row(this).data()[6];
                type = methylation27kCoxDataTable2.row(this).data()[7];
                selectedMetaFeature = methylation27kCoxDataTable2.row(this).data()[8];
                break;
            default:
                return;
        }

        // hide chart
        $('.shiny-plot-output').hide();

        MY_DATA.drop_image_columns = [];
        console.log("category=", category, "type=", type, "cox=", "cox", "selectedMetaFeature=", selectedMetaFeature, cgcite)
        drawGeneNewAftChart(category, type, "cox", selectedMetaFeature, cgcite);
    });

    /**
     * click AFT table's tr
     */
    $('#tbl-gene-protein-aft tbody, #tbl-gene-mirna-aft tbody, #tbl-gene-mrna-aft tbody, #tbl-gene-lncrna-aft tbody, #tbl-gene-methylation27k-aft tbody, #tbl-gene-methylation450k-aft tbody').on('click', 'tr', function () {
        var category = "", type = "", cgcite = "";
        switch ($(this).parent().parent().attr("id")) {
            case "tbl-gene-protein-aft":
                category = "protein";
                type = proteinAftDataTable2.row(this).data()[7];
                selectedMetaFeature = proteinAftDataTable2.row(this).data()[8];
                break;
            case "tbl-gene-mirna-aft":
                category = "mirna";
                type = miRNAAftDataTable2.row(this).data()[7];
                selectedMetaFeature = miRNAAftDataTable2.row(this).data()[8];
                break;
            case "tbl-gene-mrna-aft":
                category = "mrna";
                type = mRNAAftDataTable2.row(this).data()[7];
                selectedMetaFeature = mRNAAftDataTable2.row(this).data()[8];
                break;
            case "tbl-gene-lncrna-aft":
                category = "lncrna";
                type = lncrnaAftDataTable2.row(this).data()[7];
                selectedMetaFeature = lncrnaAftDataTable2.row(this).data()[8];
                break;
            case "tbl-gene-methylation450k-aft":
                category = "methylation450k";
                cgcite = methylation450kAftDataTable2.row(this).data()[6];
                type = methylation450kAftDataTable2.row(this).data()[7];
                selectedMetaFeature = methylation450kAftDataTable2.row(this).data()[8];
                break;
            case "tbl-gene-methylation27k-aft":
                category = "methylation27k";
                cgcite = methylation27kAftDataTable2.row(this).data()[6];
                type = methylation27kAftDataTable2.row(this).data()[7];
                selectedMetaFeature = methylation27kAftDataTable2.row(this).data()[8];
                break;
            default:
                return;
        }

        // hide chart
        $('.shiny-plot-output').hide();

        MY_DATA.drop_image_columns = [];
        console.log("category=", category, "type=", type, "aft=", "aft", "selectedMetaFeature=", selectedMetaFeature, cgcite)

        drawGeneNewAftChart(category, type, "aft", selectedMetaFeature, cgcite);
    });

    /**
     * click expression table tr
     */
    $('#tbl-gene-protein-expression tbody, #tbl-gene-mirna-expression tbody, #tbl-gene-mrna-expression tbody, #tbl-gene-lncrna-expression tbody, #tbl-gene-methylation27k-expression tbody, #tbl-gene-methylation450k-expression tbody').on('click', 'tr', function () {
        var category;
        switch ($(this).parent().parent().attr("id")) {
            case "tbl-gene-protein-expression":
                category = "protein";
                selectedMetaFeature = proteinExpDataTable2.row(this).data()[1];
                break;
            case "tbl-gene-mirna-expression":
                category = "mirna";
                selectedMetaFeature = miRNAExpDataTable2.row(this).data()[1];
                break;
            case "tbl-gene-mrna-expression":
                category = "mrna";
                selectedMetaFeature = mRNAExpDataTable2.row(this).data()[1];
                break;
            case "tbl-gene-lncrna-expression":
                category = "lncrna";
                selectedMetaFeature = lncrnaExpDataTable2.row(this).data()[1];
                break;
            case "tbl-gene-methylation450k-expression":
                category = "methylation450k";
                selectedMetaFeature = methylation450kExpDataTable2.row(this).data()[1];
                break;
            case "tbl-gene-methylation27k-expression":
                category = "methylation27k";
                selectedMetaFeature = methylation27kExpDataTable2.row(this).data()[1];
                break;
            default:
                return;
        }

        // hide chart
        $('.shiny-plot-output').hide();

        if (selectedMetaFeature == "") {
            alert("Please select a feature");
        } else {
            drawGeneBoxPlot(category, selectedMetaFeature);
        }
    });

    /**
     * click gene search button
     */
    $("#btn-gene").click(function (e) {
        if ($.trim($("#input-gene").val()) == "") {
            return;
        }

        selectedGene = $.trim($("#input-gene").val());

        try {
            $('#nav-gene').show();

            $('#nav-gene > li').hide();
            
            // console.log(rootUrl + '/api/get_category')
            $.ajax({
                url: rootUrl + '/api/get_category',
                type: "GET",
                dataType: "json",
                data: {
                    name: selectedGene,
                },
                complete: function (data, textStatus, jqXHR) {
                    console.log(has_category)
                    $('.nav-select-gene').each(function () {
                        // set option index to first
                        category = $('option:selected', this).data('category');
                        if (has_category[category]){
                            console.log(category)
                            $(this).prop("selectedIndex", 0).trigger("change");
                        }
                    })
                    stopLoading();
                },
                success: function (result, textStatus, jqXHR) {
                    startLoading()
                    has_category = result['data']
                    // trigger each dropdown list
                    
                },
                error: function (XMLHttpRequest, textStatus, errorThrown) {
                    // alert("Error");
                    alert("Status: " + textStatus + "\n"
                        + "Error: " + errorThrown);
                }
            });
            // trigger each dropdown list
            // $('.nav-select-gene').each(function () {
            //     // set option index to first
            //     $(this).prop("selectedIndex", 0).trigger("change");
            // })
        } catch (e) {
            console.log(e)
        }
    });

    // when change dropdown list
    $('.nav-select-gene').each(function () {
        $(this).on("change", function () {
            let category, value;

            category = $('option:selected', this).data('category');
            value = $(this).val();

            let tab = 'tbl-gene-sub-' + category + '-' + value;
            $('.nav-tabs a[href="#' + tab + '"]').tab('show');
            reloadGeneDataTableAjax(category, value);

            // show or hide survival type
            if (value == "expression") {
                $(this).parents('.tab-pane').find('.survival_type').hide();
            } else {
                $(this).parents('.tab-pane').find('.survival_type').show();
            }
        })
    })

    // when click enter to search instead keyup search 
    $('[id^="tbl-gene-sub-"]').each(function() {
        let tmps = $(this).attr("id").split("-");
        let category = tmps[3];
        let type = tmps[4];
        let map, dataTable;

        switch (category) {
            case "protein":
                map = {
                    "logrank": proteinDataTable2,
                    "cox": proteinCoxDataTable2,
                    "aft": proteinAftDataTable2,
                    "expression": proteinExpDataTable2,
                };
                dataTable = map[type];
                break;
            case "mirna":
                map = {
                    "logrank": miRNADataTable2,
                    "cox": miRNACoxDataTable2,
                    "aft": miRNAAftDataTable2,
                    "expression": miRNAExpDataTable2,
                };
                dataTable = map[type];
                break;
            case "mrna":
                map = {
                    "logrank": mRNADataTable2,
                    "cox": mRNACoxDataTable2,
                    "aft": mRNAAftDataTable2,
                    "expression": mRNAExpDataTable2,
                };
                dataTable = map[type];
                break;
            case "lncrna":
                map = {
                    "logrank": lncrnaDataTable2,
                    "cox": lncrnaCoxDataTable2,
                    "aft": lncrnaAftDataTable2,
                    "expression": lncrnaExpDataTable2,
                };
                dataTable = map[type];
                break;
            case "methylation450k":
                map = {
                    "logrank": methylation450kDataTable2,
                    "cox": methylation450kCoxDataTable2,
                    "aft": methylation450kAftDataTable2,
                    "expression": methylation450kExpDataTable2,
                };
                dataTable = map[type];
                break;
            case "methylation27k":
                map = {
                    "logrank": methylation27kDataTable2,
                    "cox": methylation27kCoxDataTable2,
                    "aft": methylation27kAftDataTable2,
                    "expression": methylation27kExpDataTable2,
                };
                dataTable = map[type];
                break;
            default:
                return;
        }

        $(this).find("div.dataTables_filter input").unbind().on("keyup", function (e) {
            if (e.keyCode == 13) {
                dataTable.search(this.value).draw();
            }
        });
    })

    // search for the gene names when keying input up
    $('#input-gene').on("keyup", function() {
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
        $('#input-gene').val($(this).text());
        $(this).parent().hide();
    })

    // download data
    $(".download-data").on('click', function() {
        var category, type, tab, mode, sortCol, sortDir, 
            gene = selectedGene, dataTable;

        if (gene == "") {
            return;
        }

        category = selectedGeneCategory;
        type = selectedCancerType;
        mode = 'os';
        tab = $('.tab-tag.active .nav-select-gene').val();
        
        switch (category) {
            case "protein":
                map = {
                    "logrank": proteinDataTable2,
                    "cox": proteinCoxDataTable2,
                    "aft": proteinAftDataTable2,
                    "expression": proteinExpDataTable2,
                };
                dataTable = map[tab];
                break;
            case "mirna":
                map = {
                    "logrank": miRNADataTable2,
                    "cox": miRNACoxDataTable2,
                    "aft": miRNAAftDataTable2,
                    "expression": miRNAExpDataTable2,
                };
                dataTable = map[tab];
                break;
            case "mrna":
                map = {
                    "logrank": mRNADataTable2,
                    "cox": mRNACoxDataTable2,
                    "aft": mRNAAftDataTable2,
                    "expression": mRNAExpDataTable2,
                };
                dataTable = map[tab];
                break;
            case "lncrna":
                map = {
                    "logrank": lncrnaDataTable2,
                    "cox": lncrnaCoxDataTable2,
                    "aft": lncrnaAftDataTable2,
                    "expression": lncrnaExpDataTable2,
                };
                dataTable = map[tab];
                break;
            case "methylation450k":
                map = {
                    "logrank": methylation450kDataTable2,
                    "cox": methylation450kCoxDataTable2,
                    "aft": methylation450kAftDataTable2,
                    "expression": methylation450kExpDataTable2,
                };
                dataTable = map[tab];
                break;
            case "methylation27k":
                map = {
                    "logrank": methylation27kDataTable2,
                    "cox": methylation27kCoxDataTable2,
                    "aft": methylation27kAftDataTable2,
                    "expression": methylation27kExpDataTable2,
                };
                dataTable = map[tab];
                break;
            default:
                return;
        }
        sortCol = getSortColumn(category, type, tab, dataTable.order()[0][0]);
        sortDir = dataTable.order()[0][1];

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
        $('#downloadForm').append('<input type="hidden" name="search_type" value="gene" >');
        console.log({"category": category,
                     "type":type,
                     "mode":mode,
                     "tab":tab,
                     "sortCol":sortCol,
                     "sortDir":sortDir,
                     "gene":gene,
                     "search_type":"gene",
                     "link":link
                    })
        $('#downloadForm').attr("action", link);
        $('#downloadForm').submit();
    })

    $('body').on('click', function() {
        $('.search-result').hide();
    })

    $('#tab-gene-protein > a, #tab-gene-mirna > a, #tab-gene-mrna > a, #tab-gene-lncrna > a, #tab-gene-methylation27k > a, #tab-gene-methylation450k > a').on('click', function() {
        selectedGeneCategory = $(this).data('value').toLowerCase();
    })
});

/**
 * reload sub tab data
 * @param {*} category 
 * @param {*} value 
 */
function reloadGeneDataTableAjax(category, value) {
    switch (category) {
        case "protein":
            if (value == "logrank") {
                startLoading();
                proteinDataTable2.ajax.reload();
            } else if (value == "cox") {
                startLoading();
                proteinCoxDataTable2.ajax.reload();
            } else if (value == "aft") {
                startLoading();
                proteinAftDataTable2.ajax.reload();
            } else if (value == "expression") {
                startLoading();
                proteinExpDataTable2.ajax.reload();
            }
            break;
        case "mirna":
            if (value == "logrank") {
                startLoading();
                miRNADataTable2.ajax.reload();
            } else if (value == "cox") {
                startLoading();
                miRNACoxDataTable2.ajax.reload();
            } else if (value == "aft") {
                startLoading();
                miRNAAftDataTable2.ajax.reload();
            } else if (value == "expression") {
                startLoading();
                miRNAExpDataTable2.ajax.reload();
            }
            break;
        case "mrna":
            if (value == "logrank") {
                startLoading();
                mRNADataTable2.ajax.reload();
            } else if (value == "cox") {
                startLoading();
                mRNACoxDataTable2.ajax.reload();
            } else if (value == "aft") {
                startLoading();
                mRNAAftDataTable2.ajax.reload();
            } else if (value == "expression") {
                startLoading();
                mRNAExpDataTable2.ajax.reload();
            }
            break;
        case "lncrna":
            if (value == "logrank") {
                startLoading();
                lncrnaDataTable2.ajax.reload();
            } else if (value == "cox") {
                startLoading();
                lncrnaCoxDataTable2.ajax.reload();
            } else if (value == "aft") {
                startLoading();
                lncrnaAftDataTable2.ajax.reload();
            } else if (value == "expression") {
                startLoading();
                lncrnaExpDataTable2.ajax.reload();
            }
            break;
        case "methylation450k":
            if (value == "logrank") {
                startLoading();
                methylation450kDataTable2.ajax.reload();
            } else if (value == "cox") {
                startLoading();
                methylation450kCoxDataTable2.ajax.reload();
            } else if (value == "aft") {
                startLoading();
                methylation450kAftDataTable2.ajax.reload();
            } else if (value == "expression") {
                startLoading();
                methylation450kExpDataTable2.ajax.reload();
            }
            break;
        case "methylation27k":
            if (value == "logrank") {
                startLoading();
                methylation27kDataTable2.ajax.reload();
            } else if (value == "cox") {
                startLoading();
                methylation27kCoxDataTable2.ajax.reload();
            } else if (value == "aft") {
                startLoading();
                methylation27kAftDataTable2.ajax.reload();
            } else if (value == "expression") {
                startLoading();
                methylation27kExpDataTable2.ajax.reload();
            }
            break;
    }
}

// get and show raw data
function retrieveGeneData(url, aoData, fnCallback) {
    var limit = 10, skip = 0, keyword, subCategory = "", colIndex, sortColumn, sortDir, subTab;
    for (var i = 0; i < aoData.length; i++) {
        if (aoData[i]["name"] == "iDisplayStart") {
            skip = aoData[i]["value"];
        } else if (aoData[i]["name"] == "iDisplayLength") {
            limit = aoData[i]["value"];
        } else if (aoData[i]["name"] == "sSearch") {
            keyword = aoData[i]["value"];
        } else if (aoData[i]["name"] == "sub_category") {
            subCategory = aoData[i]["value"];
        } else if (aoData[i]["name"] == "iSortCol_0") {
            colIndex = aoData[i]["value"];
        } else if (aoData[i]["name"] == "sSortDir_0") {
            sortDir = aoData[i]["value"];
        } else if (aoData[i]["name"] == "sub_tab") {
            subTab = aoData[i]["value"];
        }
    }
    var subGene = selectedGene;

    if (subCategory == "" || subGene == "") {
        return;
    }

    $('.tab-gent-content > div').each(function (index) {
        if ($(this).hasClass("active")) {
            subTab = $(this).find(".nav-select-gene").val()
        }
    })

    console.log("subCategory = " + subCategory + ", subGene = " + subGene + ", subTab = " + subTab + ", colIndex = " + colIndex)
    sortColumn = getSortColumn(subCategory, selectedCancerType, subTab, colIndex);
    survival_type = getCheckColumn(subCategory, subTab);
    
    // clear chart
    $('.shiny-plot-output').hide();

    $.ajax({
        url: url,
        type: "GET",
        dataType: "json",
        data: {
            category: subCategory,
            gene: subGene,
            search_type: "gene",
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
            if (result.data["total"] > 0) {
                // check if tab has active class
                let hasShowTab = false;
                $('#nav-gene > li').each(function (index) {
                    if (!$(this).is(":visible")) {
                        return;
                    }

                    if ($(this).hasClass("active")) {
                        hasShowTab = true;
                        return;
                    }
                })

                $('#tab-gene-' + subCategory).show();
                if (!hasShowTab) {
                    selectedGeneCategory = subCategory;
                    $('#tab-gene-' + subCategory + " > a").trigger("click");
                }
            }

            var data = getGeneCallbackData(result.data, subCategory, selectedCancerType, subTab);
            fnCallback(data); // 把返回的數據傳給這個方法就可以了,datatable會自動綁定數據的
        },
        error: function (XMLHttpRequest, textStatus, errorThrown) {
            alert("Status: " + textStatus + "\n"
                + "Error: " + errorThrown);
        }
    });
}

function chgChartTime(isModal) {
    var time = $('#chart-time').val();

    drawSubChart(MY_DATA.selectedCategory, MY_DATA.selectedCancerType, MY_DATA.selectedMetaFeature, time)
}

function drawSubChart(paramCategory, paramType, paramFeature, time) {
    var mode = $('[name="browse-gene-' + paramCategory + '"]:checked').val();
    var L_per = $('#chart-LP').val();
    var H_per = $('#chart-HP').val();

    try {
        startLoading();
        $.ajax({
            url: rootUrl + '/api/chart',
            type: "GET",
            dataType: "json",
            data: {
                category: paramCategory,
                type: paramType,
                feature: paramFeature,
                mode: mode,
                time: time,
                L_per: L_per,
                H_per: H_per
            },
            complete: function (data, textStatus, jqXHR) {
                stopLoading();
            },
            success: function (result, textStatus, jqXHR) {
                if (result.status !== "success") {
                    alert(result.message || 'error')
                    console.log("/api/chart", result)
                    return;
                }
                MY_DATA.chartJsonResult = result['data'];

                MY_DATA.gene_options["category"] = paramCategory;
                MY_DATA.gene_options["type"] = paramType;
                MY_DATA.gene_options["feature"] = paramFeature;
                MY_DATA.gene_options["mode"] = mode;

                showGeneChart();
            },
            error: function (XMLHttpRequest, textStatus, errorThrown) {
                alert("Error: " + errorThrown + '\n\n'
                    + "Message: " + XMLHttpRequest.responseJSON.replace(/\\n/g, '\n').replace(/\\"/g, '"'));
            }
        });
    } catch (e) {

    }
}

function showGeneChart() {
    var chartIndex = 0;

    if (MY_DATA.chartJsonResult["chart_data"] && MY_DATA.chartJsonResult["chart_data"][0]["chart1_data"]) {
        MY_DATA.chartJsonResult["chart_data"][0]["chart1_data"][0]["line"]["color"] = $('.chart-gene-option-color1').eq(chartIndex).val();
        MY_DATA.chartJsonResult["chart_data"][0]["chart1_data"][0]["line"]["width"] = $('.chart-gene-option-width1').eq(chartIndex).val();
        MY_DATA.chartJsonResult["chart_data"][0]["chart1_data"][1]["line"]["color"] = $('.chart-gene-option-color2').eq(chartIndex).val();
        MY_DATA.chartJsonResult["chart_data"][0]["chart1_data"][1]["line"]["width"] = $('.chart-gene-option-width2').eq(chartIndex).val();
        MY_DATA.chartJsonResult["chart_data"][0]["chart1_data"][2]["marker"]["color"] = $('.chart-gene-option-marker-color1').eq(chartIndex).val();
        MY_DATA.chartJsonResult["chart_data"][0]["chart1_data"][3]["marker"]["color"] = $('.chart-gene-option-marker-color2').eq(chartIndex).val();
    }
    var chart1_data = MY_DATA.chartJsonResult["chart_data"][0].chart1_data;
    var chart_layout = MY_DATA.chartJsonResult["chart_data"][0].layout;
    var L_per = $('#chart-LP').val();
    var H_per = $('#chart-HP').val();

    $('#chart-gene-option').show();
    $('#chart-gene').html("").show();
    Plotly.newPlot('chart-gene', chart1_data, chart_layout || {});

    var $download = '<div style="text-align:center; padding-bottom: 40px;"><a href="#" onclick="downloadChart(\'' + MY_DATA.gene_options["category"] + '\', \'' + MY_DATA.gene_options["type"] + '\', \'' + MY_DATA.gene_options["feature"] + '\', \'' + MY_DATA.gene_options["mode"] + '\', \'' + L_per + '\', \'' + H_per + '\')">Download clinical data</a></div>';
    $('#chart-gene').append($download);
}

function drawGeneBoxPlot(category, gene) {

    try {
        startLoading();

        $.ajax({
            url: rootUrl + '/api/boxplot',
            type: "GET",
            dataType: "json",
            data: {
                category: category,
                gene: gene,
            },
            complete: function (data, textStatus, jqXHR) {
                stopLoading()
            },
            success: function (result, textStatus, jqXHR) {
                if (result.status == "success") {
                    subBoxPlot(result["data"]["result"], gene, category);
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

function subBoxPlot(json, gene, category) {

    var x1 = [];
    var x2 = [];
    var trace1_y = [];
    var trace2_y = [];
    
    gene = gene.split("|")[0];
    gene = gene.split(",")[0];

    for (var type in json) {
        var normals = json[type]['normal']
        var tumors = json[type]['tumor']
        for (var i = 0; i < normals.length; i++) {
            x1.push(type);
            trace1_y.push(normals[i]);
        }
        for (var i = 0; i < tumors.length; i++) {
            x2.push(type);
            trace2_y.push(tumors[i]);
        }
    }

    var trace1 = {
        y: trace1_y,
        x: x1,
        name: 'Normal',
        marker: { color: '#3D9970' },
        type: 'box'
    };

    var trace2 = {
        y: trace2_y,
        x: x2,
        name: 'Tumor',
        marker: { color: '#FF4136' },
        type: 'box'
    };

    var data = [trace1, trace2];

    if (category==='protein'){
        var layout = {
            title: gene,
            yaxis: {
                title: 'Log (Normalized Expression value)',
                zeroline: false
            },
            boxmode: 'group'
        };
    } else if (category==='methylation27k' || category==='methylation450k' ){
        var layout = {
            title: gene,
            yaxis: {
                title: 'Log (Beta value)',
                zeroline: false
            },
            boxmode: 'group'
        };
    } else{
            var layout = {
            title: gene,
            yaxis: {
                title: 'Log (Expression value)',
                zeroline: false
            },
            boxmode: 'group'
        };
    }


    $('#chart-gene').html("").show();
    Plotly.newPlot('chart-gene', data, layout);
}

function startLoading() {
    if (loadingFlag == 0) {
        $("body").loading();
        $('.loading-overlay-content').html('<img src="' + rootUrl + '/static/images/loading.gif" /> Loading...');
    }

    loadingFlag++;
}

function stopLoading() {
    loadingFlag--;

    if (loadingFlag <= 0) {
        loadingFlag = 0;
        $("body").loading("stop");
    }
}

/**
 * Drawing more gene's cox or aft chart
 * @param {*} category 
 * @param {*} type 
 * @param {*} tab 
 * @param {*} feature 
 * @param {*} cgcite 
 */
function drawGeneNewAftChart(category, type, tab, feature, cgcite, ignore) {
    startLoading();

    var $chart = $('#chart-cox');
    var $chart2 = $('#chart-cox-option');
    var survivalType = $('[name="browse-gene-' + category + '"]:checked').val();

    $.ajax({
        url: rootUrl + '/api/aftplot',
        type: "POST",
        dataType: "json",
        data: {
            category: category,
            tab: tab,
            type: type,
            feature: feature,
            cgcite: cgcite,
            survival_type: survivalType,
            drop_image_columns: MY_DATA.drop_image_columns
        },
        complete: function (data, textStatus, jqXHR) {
            stopLoading();
        },
        success: function (result, textStatus, jqXHR) {
            if (result.status == "success") {
                MY_DATA.chartData = result;
                showImgTable(category, type, feature, cgcite, survivalType, $chart, tab);

                if (ignore !== 1) {
                    _showSelectColumns($chart2);
                }
            } else {
                alert(result.message || "error");
            }
        },
        error: function (XMLHttpRequest, textStatus, errorThrown) {
            alert("Error: " + XMLHttpRequest);
        }
    });

    function _showSelectColumns($chartObj) {
        let htmls = [], tmpKeys = [], key, i;

        for (key in MY_DATA.chartData["data"]["summary"]) {
            tmpKeys.push(key);
        }
        
        htmls.push('<div>Remove features&emsp;');
        for (i = 0; i < tmpKeys.length; i ++) {
            if (tmpKeys[i] == "Intercept") {
                continue;
            }
            htmls.push('<label><input type="checkbox" name="img_checkbox" value="' + tmpKeys[i] + '" checked="checked" /> ' + tmpKeys[i] + '</label>&emsp;');
        }
        htmls.push('<button class="btn btn-default btn-sm" type="button">Calculate</button>');
        htmls.push('</div>');

        // upload custom excel html
        htmls.push('<div>');
        htmls.push('<input type="file" name="upload_file" class="cox_aft_file" accept=".csv" style="display: none;" />');
        htmls.push('<span class="temp_file_text"></span>');
        htmls.push('<input type="button" class="select_file" value="Select file" />&emsp;');
        htmls.push('<input type="button" class="csv_upload" value="Upload & reanalyze" />');
        htmls.push('</div>');

        $chartObj.show();
        $chartObj.html(htmls.join(''));

        // listening event and redraw table
        $chartObj.find('.btn').on('click', function() {
            MY_DATA.drop_image_columns = [];
            $chartObj.find('[name="img_checkbox"]').each(function() {
                if (!$(this).prop("checked")) {
                    MY_DATA.drop_image_columns.push($(this).val());
                }
            })
    
            drawGeneNewAftChart(category, type, tab, feature, cgcite, 1);
        })
        
        // listening trigger file
        $chartObj.find('.select_file').on('click', function() {
            $chartObj.find('.cox_aft_file').trigger("click");
        });
        $chartObj.find('.cox_aft_file').on('change', function() {
            $chartObj.find('.temp_file_text').html($(this).val());
        });
        $chartObj.find('.csv_upload').on('click', function() { // do upload custom excel
            if ($chartObj.find('.cox_aft_file').val() == "") {
                alert("Please select a file.");
                return;
            }

            startLoading();

            var file_data = $chartObj.find('.cox_aft_file').prop('files')[0];   
            var form_data = new FormData();
            form_data.append('upload_file', file_data);
            form_data.append('category', category);
            form_data.append('tab', tab);
            form_data.append('type', type);
            form_data.append('feature', feature);
            form_data.append('cgcite', cgcite);
            form_data.append('survival_type', survivalType);
            $.ajax({
                url: rootUrl + '/api/aftplot/upload', // <-- point to server-side PHP script 
                dataType: 'json',  // <-- what to expect back from the PHP script, if anything
                cache: false,
                contentType: false,
                processData: false,
                data: form_data,                         
                type: 'post',
                complete: function (data, textStatus, jqXHR) {
                    stopLoading();
                },
                success: function (result, textStatus, jqXHR) {
                    if (result.status == "success") {
                        MY_DATA.chartData = result;

                        var $chartUpload = $('#chart-upload');
                        showImgTable(category, type, feature, cgcite, survivalType, $chartUpload, tab, 1);
                    } else {
                        alert(result.message || "error");
                    }
                },
                error: function (XMLHttpRequest, textStatus, errorThrown) {
                    alert("Error: " + XMLHttpRequest);
                }
            });
        });
    }
}

/**
 * Show cox or aft image's table
 */
function showImgTable(category, type, feature, cgcite, survivalType, $chart, tab, hideDownload) {
    let htmls = [], tmpKey, key, i, tmpName, tmpVal, j;

    var summaries = [];
    for (key in MY_DATA.chartData["data"]["summary"]) {
        var tmpData = MY_DATA.chartData["data"]["summary"][key];
        tmpData["_gene_name"] = key;
        summaries.push(tmpData);
    }

    htmls.push('<div class="row">');
    htmls.push('<div class="col-sm-7">' + MY_DATA.chartData["data"]["img"]);
    htmls.push('</div>');
    htmls.push('<div class="col-sm-5 img-table-container" style="margin-top: 20px;">');
    if (summaries.length > 0) {
        tmpName = "HR";
        if (tab == "aft") {
            tmpName = "TR";
        }
        htmls.push('<table class="table table-bordered">');
        htmls.push('<tr align="center"><td scope="col"></td><td scope="col">' + tmpName + '</td><td scope="col">Confidence Interval</td>');
        htmls.push('<td scope="col">P-val</td>');
        if (MY_DATA.chartData["data"]["test_summary"]) {
            htmls.push('<td scope="col">PH-assumption</td>');
        }
        htmls.push('</tr>');

        summaries.sort(function(a, b) {
            return parseFloat(a["p"]) - parseFloat(b["p"]);
        });
        
        for (i = 0; i < summaries.length; i ++) {
            tmpKey = summaries[i]["_gene_name"];
            htmls.push('<tr align="center"><td>' + tmpKey + '</td><td>' + summaries[i]["exp(coef)"].toFixed(2) + '</td>');
            htmls.push('<td>[' + summaries[i]["exp(coef) lower 95%"].toFixed(2) + ', ' + summaries[i]["exp(coef) upper 95%"].toFixed(2) + ']</td>');
            if(parseFloat(summaries[i]["p"]) < 0.05) {
                htmls.push('<td style="white-space: nowrap; color: red;">' + summaries[i]["p"] + '</td>');
            }else{
                htmls.push('<td style="white-space: nowrap;">' + summaries[i]["p"] + '</td>');
            }
            if (MY_DATA.chartData["data"]["test_summary"]) {
                tmpVal = "";
                for (j = 0; j < MY_DATA.chartData["data"]["test_summary"]["name"].length; j ++) {
                    if (tmpKey == MY_DATA.chartData["data"]["test_summary"]["name"][j]) {

                        tmpVal = MY_DATA.chartData["data"]["test_summary"]["p_value"][j];
                        try {
                            tmpVal = tmpVal.toFixed(2);
                        } catch (ex) {
                            tmpVal = 0;
                        }
                        if (tmpVal <= 0.05) {
                            tmpVal = '<span style="color: red;">' + tmpVal + '</span>';
                        }
                        break;
                    }
                }
                htmls.push('<td scope="col">' + tmpVal + '</td>');
            }
            htmls.push('</tr>');
        }

        htmls.push('</table>');
    }
    htmls.push('</div>');
    htmls.push('</div>');

    $chart.show();
    $chart.html(htmls.join(''));

    if (hideDownload != 1) {
        var $download = '<div style="text-align:center; padding-bottom: 40px;"><a href="#" onclick="downloadAftPlot(\'' + category + '\', \'' + type + '\', \'' + feature + '\', \'' + cgcite + '\', \'' + survivalType + '\')">Download clinical data</a></div>';
        $chart.append($download);
    }
}

function getSortColumn(category, type, subTab, index) {
    let mapping = [];
    var suffix = $('[name="browse-gene-' + category + '"]:checked').val();
    switch (subTab) {
        case "logrank":
            mapping.push('type');
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
            mapping.push('type');
            if (["methylation27k", "methylation450k"].includes(category)) {
                mapping.push('Cgcite');
            }
            mapping.push('MetaFeature');
            if (["mrna", "mirna"].includes(category)) {
                mapping.push('MetaFeature');
            }
            if (suffix == 'os') {
                mapping.push("exp_coef_OS");
                mapping.push("exp_p_val_OS");
                mapping.push("fdr_exp_os");
            } else if (suffix == "pfi") {
                mapping.push("exp_coef_PFI");
                mapping.push("exp_p_val_PFI");
                mapping.push("fdr_exp_pfi");
            } else if (suffix == "dfi") {
                mapping.push("exp_coef_DFI");
                mapping.push("exp_p_val_DFI");
                mapping.push("fdr_exp_dfi");
            } else {
                mapping.push("exp_coef_DSS");
                mapping.push("exp_p_val_DSS");
                mapping.push("fdr_exp_dss");
            }
            break;
        case "expression":
            mapping.push('type');
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
    var suffix = $('[name="browse-gene-' + category + '"]:checked').val();
    var checkColumn = "";
    switch (subTab) {
        case "logrank":
            if (suffix == 'os') {
                checkColumn = "os_exp"
            } else if (suffix == "pfi") {
                checkColumn = "pfi_exp";
            } else if (suffix == "dfi") {
                checkColumn = "dfi_exp";
            } else {
                checkColumn = "dss_exp";
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
            checkColumn = "normal_exp"
            break;
    }
    return checkColumn
}


/**
 * 取得欄位
 * @param {*} category 
 * @param {*} type 
 * @param {*} subTab 
 * @returns 
 */
function getGeneColumns(category, type, subTab) {
    var data = [];
    var suffix = $('[name="browse-gene-' + category + '"]:checked').val();
    var upperSuffix = suffix.toUpperCase();

    switch (subTab) {
        case "logrank":
            data.push({ title: 'Cancer type' });
            if (["methylation27k", "methylation450k"].includes(category)) {
                data.push({ title: 'CpG site' });
            }

            var sep = "|";
            if (category == "mirna") {
                sep = ",";
            }
            var index = 1;
            if (["methylation27k", "methylation450k"].includes(category)) {
                index = 2;
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
            data.push({ title: 'P-val (' + upperSuffix + ')' });
            data.push({ title: 'Adjusted P-val (' + upperSuffix + ')' });

            break;
        case "cox":
        case "aft":
            if (category == "mrna") {
                data = [
                    {
                        title: "Cacner type", render: function (data, type, row, meta) {
                            return data;
                        }
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
                        title: "Coefficient (" + upperSuffix + ")", render: function (data, type, row, meta) {
                            return row[2];
                        }
                    },
                    {
                        title: "P-val (" + upperSuffix + ")", render: function (data, type, row, meta) {
                            return row[3];
                        }
                    },
                    {
                        title: "Adjusted P-val (" + upperSuffix + ")", render: function (data, type, row, meta) {
                            return row[4];
                        }
                    },
                ];
            } else {

                var index = 1;
                if (["methylation27k", "methylation450k"].includes(category)) {
                    index = 2;
                }

                data.push({ title: 'Cancer type' });
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
                data.push({ title: 'Coefficient (' + upperSuffix + ')' });
                data.push({ title: 'P-val (' + upperSuffix + ')' });
                data.push({ title: 'Adjusted P-val (' + upperSuffix + ')' });
            }
            break;
        case "expression":
            
            var sep = "|";
            if (category == "mirna") {
                sep = ",";
            }
            var index = 1;
            if (["methylation27k", "methylation450k"].includes(category)) {
                index = 2;
            }

            data.push({ title: 'Cancer type' });
            if (["methylation27k", "methylation450k"].includes(category)) {
                data.push({ title: 'CpG site' });
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
            break;
    }

    return data;
}

/**
 * 取得callback組成資料a
 * @param {*} data 
 * @param {*} category 
 * @param {*} type 
 * @param {*} subTab 
 * @returns 
 */
function getGeneCallbackData(data, category, type, subTab) {
    var details = [];
    var suffix = $('[name="browse-gene-' + category + '"]:checked').val();

    function _get(data, category, type, subTab) {
        var tmpKeys = [];

        switch (subTab) {
            case "logrank":
                tmpKeys.push("type");
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

                if (suffix == 'os') {
                    tmpKeys.push("os_exp");
                    tmpKeys.push("fdr_os_p");
                } else if (suffix == "pfi") {
                    tmpKeys.push("pfi_exp");
                    tmpKeys.push("fdr_pfi_p");
                } else if (suffix == "dfi") {
                    tmpKeys.push("dfi_exp");
                    tmpKeys.push("fdr_dfi_p");
                } else {
                    tmpKeys.push("dss_exp");
                    tmpKeys.push("fdr_dss_p");
                }
                tmpKeys.push("type");
                tmpKeys.push("MetaFeature");
                break;
            case "cox":
            case "aft":
                tmpKeys.push("type");
                if (["methylation27k", "methylation450k"].includes(category)) {
                    tmpKeys.push("Cgcite");
                }
                if (category == "lncrna") {
                    tmpKeys.push("gene_symbol");
                } else {
                    tmpKeys.push("MetaFeature");
                }
                if (["mirna"].includes(category)) {
                    tmpKeys.push("MetaFeature");
                }

                if (suffix == 'os') {
                    tmpKeys.push("exp_coef_OS");
                    tmpKeys.push("exp_p_val_OS");
                    tmpKeys.push("fdr_exp_os");
                } else if (suffix == "pfi") {
                    tmpKeys.push("exp_coef_PFI");
                    tmpKeys.push("exp_p_val_PFI");
                    tmpKeys.push("fdr_exp_pfi");
                } else if (suffix == "dfi") {
                    tmpKeys.push("exp_coef_DFI");
                    tmpKeys.push("exp_p_val_DFI");
                    tmpKeys.push("fdr_exp_dfi");
                } else {
                    tmpKeys.push("exp_coef_DSS");
                    tmpKeys.push("exp_p_val_DSS");
                    tmpKeys.push("fdr_exp_dss");
                }

                tmpKeys.push("cgcite");
                tmpKeys.push("type");
                tmpKeys.push("MetaFeature");
                break;
            case "expression":
                tmpKeys.push("type");
                if (["methylation27k", "methylation450k"].includes(category)) {
                    tmpKeys.push("Cgcite");
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
                tmpKeys.push("type");
                break;
        }

        var d = [];
        for (var i = 0; i < tmpKeys.length; i++) {
            // 忽略大小寫
            var val = data[Object.keys(data).find(key => key.toUpperCase() === tmpKeys[i].toUpperCase())];
            if (typeof val == "undefined" || ["", "NA", "NAN"].includes(val)) {
                d.push("-");
            } else {
                if (i == 0) {
                    if (typeof MY_DATA.cancer_abbr[val] != "undefined") {
                        val = MY_DATA.cancer_abbr[val] + " (" + val + ")";
                    }
                }
                d.push(val);
            }
        }
        return d;
    }

    for (var i in data.d) {
        details.push(_get(data.d[i], category, type, subTab));
    }

    var result = {
        "sEcho": "test",
        "iTotalRecords": data["total"],
        "iTotalDisplayRecords": data["total"],
        "aaData": details,
    };

    showGeneThTitle(category, type, subTab);

    return result;

}

/**
 * 物理強制改變名稱
 * @param {*} category 
 * @param {*} type 
 * @param {*} subTab 
 */
function showGeneThTitle(category, type, subTab) {

    var columns = getGeneColumns(category, type, subTab);
    $('#tbl-gene-' + category + '-' + subTab).find('tr:eq(0) th').each(function (index) {
        $(this).text(columns[index]["title"]);
    })

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

function downloadChart(category, type, feature, mode, L_per, H_per) {
    window.open(rootUrl + '/api/chart/download?category=' + category + '&type=' + type + '&feature=' + feature + '&mode=' + mode + '&L_per=' + L_per + '&H_per=' + H_per);
}

function downloadAftPlot(category, type, feature, cgcite, survivalType) {
    window.open(rootUrl + '/api/aftplot/download?category=' + category + '&type=' + type + '&feature=' + feature + '&cgcite=' + cgcite + '&survival_type=' + survivalType);
}