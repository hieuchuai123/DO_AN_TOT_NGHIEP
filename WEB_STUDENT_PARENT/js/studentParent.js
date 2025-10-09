$(document).ready(function () {
  $(".nav-link").click(function (e) {
    e.preventDefault();

    $(".nav-link").removeClass("active");
    $(this).addClass("active");

    const section = $(this).data("section");
    $(".content-section").addClass("d-none");
    $(`#section-${section}`).removeClass("d-none");
  });

  $("#logoutBtn").click(function () {
    alert("Đăng xuất thành công!");
  });
});
