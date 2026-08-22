document.addEventListener('DOMContentLoaded', () => {
    // Подгрузка настроек с бэкенда при открытии сайта
    fetch('/api/settings')
        .then(res => res.json())
        .then(settings => {
            if (settings.name) {
                document.getElementById('page-title').innerText = `${settings.name} — ${settings.position}`;
                document.getElementById('nav-name').innerText = settings.name;
                document.getElementById('hero-name').innerText = settings.name;
                document.getElementById('hero-position').innerText = settings.position;
                document.getElementById('about-text').innerText = settings.about;
                document.getElementById('footer-copy').innerText = `© 2026 ${settings.name}. Все права защищены.`;
            }
            if (settings.photo) {
                document.getElementById('makar-photo').src = settings.photo;
            }
            if (settings.whatsapp) document.getElementById('link-whatsapp').href = settings.whatsapp;
            if (settings.telegram) document.getElementById('link-telegram').href = settings.telegram;
        })
        .catch(err => console.error('Не удалось загрузить настройки сайта', err));

    // Обработка отправки заявки
    const form = document.getElementById('booking-form');
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());

        try {
            const response = await fetch('/api/leads', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });

            if (response.ok) {
                form.classList.add('hidden');
                document.getElementById('form-success').classList.remove('hidden');
            } else {
                alert('Ошибка при отправке заявки. Пожалуйста, попробуйте еще раз.');
            }
        } catch (err) {
            console.error(err);
            alert('Ошибка соединения с сервером.');
        }
    });
});
