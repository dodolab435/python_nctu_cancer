$(function() {
    
    $('#page').click(function(e)
    {
        selectedTab = $(e.target).attr("data-tab");
        selectedTab = "browse";
    });

})