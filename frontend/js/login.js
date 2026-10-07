document.addEventListener('DOMContentLoaded', async () => {
  const user = await window.API.me();
  if (user) {
    window.location.href = '/overview.html';
    return;
  }

  const form = document.getElementById('login-form');
  const errorDiv = document.getElementById('login-error');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorDiv.classList.add('hidden');
    const username = (document.getElementById('username').value || '').trim();
    const password = (document.getElementById('password').value || '').trim();
    const btn = form.querySelector('button');
    btn.disabled = true;
    btn.textContent = 'Logging in...';

    try {
      await window.API.login(username, password);
      window.location.href = '/overview.html';
    } catch (err) {
      errorDiv.textContent = err.message || 'Login failed';
      errorDiv.classList.remove('hidden');
      btn.disabled = false;
      btn.textContent = 'Login';
    }
  });
});
