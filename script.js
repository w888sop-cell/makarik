// Функция входа в админку
function checkAdminLogin() {
    const passwordInput = document.getElementById('password'); // ID поля ввода пароля
    const enteredPassword = passwordInput ? passwordInput.value : '';

    // Наш пароль
    const correctPassword = 'prob999';

    if (enteredPassword === correctPassword) {
        // Запоминаем, что мы вошли (сохраняем в памяти браузера)
        localStorage.setItem('isAdminLoggedIn', 'true');
        
        // Перенаправляем на страницу админки
        window.location.href = 'admin.html';
    } else {
        alert('Неправильный пароль!');
    }
}

// Проверка на странице admin.html (добавьте в самое начало файла админки)
function protectAdminPage() {
    const isLoggedIn = localStorage.getItem('isAdminLoggedIn');
    if (isLoggedIn !== 'true') {
        // Если не вошел — выгоняем обратно на страницу логина
        window.location.href = 'login.html';
    }
}
