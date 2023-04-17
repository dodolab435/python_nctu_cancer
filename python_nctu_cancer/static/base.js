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