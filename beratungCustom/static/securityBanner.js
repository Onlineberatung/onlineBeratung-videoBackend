function securityBanner(e) {
  e.preventDefault();
  document
  .querySelector('.securityBanner')
  .parentNode.removeChild(
      document.querySelector('.securityBanner')
  );
}
if (!window.chrome) {
  document
  .querySelector('.securityBanner').style.display = 'block'
}
document
.querySelector('.securityBanner a.close')
.addEventListener('click', securityBanner);
