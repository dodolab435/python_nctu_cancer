$(function () {
    $("#email").text("dodochen@nctu.edu.tw");
});

var loadingFlag = 0
function startLoading() {
    if (MY_DATA.loadingFlag == 0) {
        $("body").loading();
        $('.loading-overlay-content').html('<img src="' + rootUrl + '/static/images/loading.gif" /> Loading...');
    }

    MY_DATA.loadingFlag++;
}
function stopLoading() {
    loadingFlag--;

    if (loadingFlag <= 0) {
        loadingFlag = 0;
        $("body").loading("stop");
    }
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
            'copy', 'csv', 'excel', 'pdf', 'print'
        ],
    });

    MY_DATA.modalDataTable = dataTable;

    // listen dataTable's event
    listenDataTableEvent($table, dataTable, MY_DATA.modalCategory, MY_DATA.modalCancerType, MY_DATA.modalTab);
}