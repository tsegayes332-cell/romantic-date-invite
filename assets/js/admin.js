/* Admin dashboard: ask before deleting a response. */
(function () {
  'use strict';
  document.addEventListener('submit', function (e) {
    var form = e.target;
    if (form && form.matches && form.matches('form[data-confirm]')) {
      if (!window.confirm(form.getAttribute('data-confirm'))) e.preventDefault();
    }
  });
})();
