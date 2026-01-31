<?php
// index.php
header('Content-Type: text/html; charset=utf-8');
?>
<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Выбор интегратора</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        }
        
        body {
            background-color: #f5f7fa;
            color: #333;
            line-height: 1.6;
            padding: 20px;
            max-width: 1200px;
            margin: 0 auto;
        }
        
        .container {
            display: flex;
            flex-direction: column;
            gap: 30px;
        }
        
        .header {
            text-align: center;
            margin-bottom: 10px;
        }
        
        .header h1 {
            color: #2c3e50;
            margin-bottom: 5px;
            font-size: 28px;
        }
        
        .header p {
            color: #7f8c8d;
            font-size: 16px;
        }
        
        .main-content {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 30px;
        }
        
        @media (max-width: 900px) {
            .main-content {
                grid-template-columns: 1fr;
            }
        }
        
        .card {
            background-color: white;
            border-radius: 12px;
            box-shadow: 0 5px 15px rgba(0, 0, 0, 0.08);
            padding: 25px;
            transition: transform 0.3s ease, box-shadow 0.3s ease;
        }
        
        .card:hover {
            transform: translateY(-5px);
            box-shadow: 0 8px 25px rgba(0, 0, 0, 0.1);
        }
        
        .card-title {
            color: #2c3e50;
            margin-bottom: 20px;
            padding-bottom: 10px;
            border-bottom: 2px solid #f0f2f5;
            font-size: 22px;
            display: flex;
            align-items: center;
            gap: 10px;
        }
        
        .card-title i {
            color: #3498db;
        }
        
        .integrator-selector {
            display: flex;
            flex-direction: column;
            gap: 20px;
        }
        
        .search-container {
            position: relative;
        }
        
        .search-label {
            display: block;
            margin-bottom: 8px;
            font-weight: 600;
            color: #2c3e50;
        }
        
        .search-input {
            width: 100%;
            padding: 14px 20px;
            border: 2px solid #e0e6ed;
            border-radius: 10px;
            font-size: 16px;
            transition: all 0.3s;
        }
        
        .search-input:focus {
            outline: none;
            border-color: #3498db;
            box-shadow: 0 0 0 3px rgba(52, 152, 219, 0.2);
        }
        
        .datalist-container {
            position: relative;
            
        }
        
        .datalist-options {
            position: absolute;
            top: 100%;
            left: 0;
            right: 0;
            background-color: white;
            border: 1px solid #e0e6ed;
            border-radius: 8px;
            max-height: 300px;
            overflow-y: auto;
            z-index: 100;
            box-shadow: 0 5px 15px rgba(0, 0, 0, 0.08);
            display: none;
        }
        
        .datalist-option {
            padding: 12px 20px;
            cursor: pointer;
            transition: background-color 0.2s;
            border-bottom: 1px solid #f5f7fa;
            flex-direction: column;
    display: flex;
    align-items: start;
    justify-content: start;
        }
        
        .datalist-option:hover {
            background-color: #f8fafc;
        }
        
        .datalist-option:last-child {
            border-bottom: none;
        }
        
        .integrator-name {
            font-weight: 600;
            color: #2c3e50;
        }
        
        .integrator-id {
            color: #7f8c8d;
            font-size: 14px;
        }
        
        .select-button {
            background-color: #3498db;
            color: white;
            border: none;
            border-radius: 10px;
            padding: 15px 25px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            transition: background-color 0.3s, transform 0.2s;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 10px;
        }
        
        .select-button:hover {
            background-color: #2980b9;
            transform: translateY(-2px);
        }
        
        .select-button:active {
            transform: translateY(0);
        }
        
        .select-button:disabled {
            background-color: #bdc3c7;
            cursor: not-allowed;
            transform: none;
        }
        
        .selected-integrator {
            background-color: #f8fafc;
            border-radius: 10px;
            padding: 20px;
            margin-top: 10px;
            display: none;
        }
        
        .selected-integrator.show {
            display: block;
            animation: fadeIn 0.5s;
        }
        
        .selected-title {
            font-weight: 600;
            color: #2c3e50;
            margin-bottom: 10px;
            font-size: 18px;
        }
        
        .selected-info {
            display: flex;
            align-items: center;
            gap: 15px;
        }
        
        .avatar {
            width: 60px;
            height: 60px;
            background-color: #3498db;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-size: 22px;
            font-weight: 600;
        }
        
        .selected-details h3 {
            color: #2c3e50;
            margin-bottom: 5px;
        }
        
        .selected-details p {
            color: #7f8c8d;
        }
        
        .application-details {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
            gap: 20px;
        }
        
        .detail-item {
            display: flex;
            flex-direction: column;
            gap: 5px;
        }
        
        .detail-label {
            font-size: 14px;
            color: #7f8c8d;
            font-weight: 500;
        }
        
        .detail-value {
            font-size: 16px;
            color: #2c3e50;
            font-weight: 600;
            padding: 10px 15px;
            background-color: #f8fafc;
            border-radius: 8px;
            min-height: 45px;
            display: flex;
            align-items: center;
        }
        
        .status-badge {
            display: inline-block;
            padding: 5px 12px;
            border-radius: 20px;
            font-size: 14px;
            font-weight: 600;
        }
        
        .status-pending {
            background-color: #fff4e5;
            color: #ff9900;
        }
        
        .status-accepted {
            background-color: #e5f7ee;
            color: #00a86b;
        }
        
        .status-in_progress {
            background-color: #e5f0ff;
            color: #3498db;
        }
        
        .status-review {
            background-color: #f0e5ff;
            color: #9b59b6;
        }
        
        .status-completed {
            background-color: #e5f7ee;
            color: #27ae60;
        }
        
        .status-approved {
            background-color: #e5f7ee;
            color: #2ecc71;
        }
        
        .status-rejected {
            background-color: #ffe5e5;
            color: #e74c3c;
        }
        
        .notification {
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 25px;
            border-radius: 10px;
            color: white;
            font-weight: 600;
            box-shadow: 0 5px 15px rgba(0, 0, 0, 0.1);
            z-index: 1000;
            opacity: 0;
            transform: translateX(100px);
            transition: opacity 0.3s, transform 0.3s;
        }
        
        .notification.show {
            opacity: 1;
            transform: translateX(0);
        }
        
        .notification.success {
            background-color: #2ecc71;
        }
        
        .notification.error {
            background-color: #e74c3c;
        }
        
        .empty-state {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 400px;
            text-align: center;
            color: #95a5a6;
        }
        
        .empty-state i {
            font-size: 64px;
            margin-bottom: 20px;
            color: #bdc3c7;
        }
        
        .empty-state h3 {
            color: #7f8c8d;
            margin-bottom: 10px;
        }
        
        @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }
        
        .loading {
            display: inline-block;
            width: 20px;
            height: 20px;
            border: 3px solid rgba(255,255,255,.3);
            border-radius: 50%;
            border-top-color: white;
            animation: spin 1s ease-in-out infinite;
        }
        
        @keyframes spin {
            to { transform: rotate(360deg); }
        }
        
        .footer {
            text-align: center;
            margin-top: 20px;
            color: #95a5a6;
            font-size: 14px;
            padding-top: 20px;
            border-top: 1px solid #ecf0f1;
        }
        
        .full-width {
            grid-column: 1 / -1;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1><i class="fas fa-user-tie"></i> Выбор интегратора</h1>
            <p>Выберите интегратора для обработки заявки</p>
        </div>
        
        <div class="main-content">
            <div class="card integrator-selector">
                <h2 class="card-title"><i class="fas fa-search"></i> Поиск интегратора</h2>
                
                <div class="search-container">
                    <label class="search-label" for="integratorSearch">Введите имя интегратора:</label>
                    <input type="text" id="integratorSearch" class="search-input" placeholder="Начните вводить имя или фамилию..." autocomplete="off">
                    <div class="datalist-container">
                        <div id="integratorOptions" class="datalist-options"></div>
                    </div>
                </div>
                
                <button id="selectButton" class="select-button" disabled>
                    <i class="fas fa-check-circle"></i> Выбрать интегратора
                </button>
                
                <div id="selectedIntegrator" class="selected-integrator">
                    <div class="selected-title">Выбранный интегратор:</div>
                    <div class="selected-info">
                        <div class="avatar" id="selectedAvatar"></div>
                        <div class="selected-details">
                            <h3 id="selectedName"></h3>
                            <p id="selectedId"></p>
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="card">
                <h2 class="card-title"><i class="fas fa-file-alt"></i> Данные заявки</h2>
                
                <div id="applicationEmptyState" class="empty-state">
                    <i class="fas fa-clipboard-list"></i>
                    <h3>Заявка не выбрана</h3>
                    <p>Выберите интегратора для загрузки данных заявки</p>
                </div>
                
                <div id="applicationDetails" class="application-details" style="display: none;">
                    <div class="detail-item">
                        <span class="detail-label">Статус заявки:</span>
                        <div class="detail-value">
                            <span id="status" class="status-badge status-pending">В ожидании</span>
                        </div>
                    </div>
                    
                    <div class="detail-item">
                        <span class="detail-label">ID сделки:</span>
                        <div class="detail-value" id="dealId">2456</div>
                    </div>
                    
                    <div class="detail-item">
                        <span class="detail-label">Био клиента:</span>
                        <div class="detail-value" id="clientBio">Иван Иванов, 35 лет, постоянный клиент</div>
                    </div>
                    
                    <div class="detail-item">
                        <span class="detail-label">Телефон клиента:</span>
                        <div class="detail-value" id="clientPhone">+7 (912) 345-67-89</div>
                    </div>
                    
                    <div class="detail-item">
                        <span class="detail-label">Город:</span>
                        <div class="detail-value" id="city">Москва</div>
                    </div>
                    
                    <div class="detail-item">
                        <span class="detail-label">Тип заявки:</span>
                        <div class="detail-value" id="type">Покупка автомобилей</div>
                    </div>
                    
                    <div class="detail-item">
                        <span class="detail-label">Количество авто:</span>
                        <div class="detail-value" id="carQuantity">3</div>
                    </div>
                    
                    <div class="detail-item">
                        <span class="detail-label">Марка автомобиля:</span>
                        <div class="detail-value" id="carBrand">Toyota, BMW</div>
                    </div>
                    
                    <div class="detail-item full-width">
                        <span class="detail-label">Комментарий:</span>
                        <div class="detail-value" id="comment">Клиент заинтересован в автомобилях премиум-класса. Необходима консультация по техническим характеристикам и условиям финансирования.</div>
                    </div>
                </div>
            </div>
        </div>
        
        <div class="footer">
            <p>Система управления интеграторами © 2023</p>
        </div>
    </div>
    
    <div id="notification" class="notification"></div>

    <script src="https://cdn.jsdelivr.net/npm/axios/dist/axios.min.js"></script>
    
    <script>
        // Моковые данные интеграторов (в реальном приложении будут загружаться через API)
        const integrators = [];

     axios.get('https://application-bek.onrender.com/api/v1/user/')
  .then(res => {

    // axios сразу кладёт данные в res.data
    console.log(res.data);

    res.data.map(user => {
      integrators.push({
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email
      });
    });

    console.log(integrators);
  })
  .catch(err => {
    console.error(err);
  });

        
        // Моковые данные заявок для разных интеграторов
        const applicationsByIntegrator = {
            101: {
                dealId: 2456,
                status: "pending",
                clientBio: "Иван Иванов, 35 лет, постоянный клиент",
                clientPhone: "+7 (912) 345-67-89",
                city: "Москва",
                type: "Покупка автомобилей",
                carQuantity: "3",
                carBrand: "Toyota, BMW",
                comment: "Клиент заинтересован в автомобилях премиум-класса. Необходима консультация по техническим характеристикам и условиям финансирования."
            },
            102: {
                dealId: 2457,
                status: "pending",
                clientBio: "Ольга Семенова, 42 года, новый клиент",
                clientPhone: "+7 (923) 456-78-90",
                city: "Санкт-Петербург",
                type: "Аренда автомобиля",
                carQuantity: "1",
                carBrand: "Mercedes-Benz",
                comment: "Нужен автомобиль на месяц для деловой поездки. Предпочтение отдается машинам бизнес-класса."
            },
            103: {
                dealId: 2458,
                status: "pending",
                clientBio: "Сергей Козлов, 28 лет, постоянный клиент",
                clientPhone: "+7 (934) 567-89-01",
                city: "Екатеринбург",
                type: "Техническое обслуживание",
                carQuantity: "2",
                carBrand: "Volkswagen, Skoda",
                comment: "Необходимо пройти плановое ТО для двух автомобилей. Один из них требует замены тормозных колодок."
            },
            104: {
                dealId: 2459,
                status: "pending",
                clientBio: "Анна Воробьева, 31 год, новый клиент",
                clientPhone: "+7 (945) 678-90-12",
                city: "Казань",
                type: "Покупка автомобиля",
                carQuantity: "1",
                carBrand: "Audi",
                comment: "Ищет компактный кроссовер для города. Важны экономичность и маневренность. Бюджет до 3 млн руб."
            },
            105: {
                dealId: 2460,
                status: "pending",
                clientBio: "Дмитрий Новиков, 50 лет, VIP-клиент",
                clientPhone: "+7 (956) 789-01-23",
                city: "Сочи",
                type: "Покупка автомобиля",
                carQuantity: "1",
                carBrand: "Porsche",
                comment: "Интересует спортивный автомобиль. Готов рассмотреть варианты с пробегом в отличном состоянии. Бюджет не ограничен."
            }
        };
        
        // Статусы на русском языке
        const statusTranslations = {
            "pending": "В ожидании",
            "accepted": "Принято",
            "in_progress": "В работе",
            "review": "На проверке",
            "completed": "Завершено",
            "approved": "Подтверждено",
            "rejected": "Отклонено"
        };
        
        // Классы для статусов
        const statusClasses = {
            "pending": "status-pending",
            "accepted": "status-accepted",
            "in_progress": "status-in_progress",
            "review": "status-review",
            "completed": "status-completed",
            "approved": "status-approved",
            "rejected": "status-rejected"
        };
        
        // DOM элементы
        const integratorSearch = document.getElementById('integratorSearch');
        const integratorOptions = document.getElementById('integratorOptions');
        const selectButton = document.getElementById('selectButton');
        const selectedIntegrator = document.getElementById('selectedIntegrator');
        const selectedAvatar = document.getElementById('selectedAvatar');
        const selectedName = document.getElementById('selectedName');
        const selectedId = document.getElementById('selectedId');
        const notification = document.getElementById('notification');
        const applicationEmptyState = document.getElementById('applicationEmptyState');
        const applicationDetails = document.getElementById('applicationDetails');
        
        // Элементы данных заявки
        const statusElement = document.getElementById('status');
        const dealIdElement = document.getElementById('dealId');
        const clientBioElement = document.getElementById('clientBio');
        const clientPhoneElement = document.getElementById('clientPhone');
        const cityElement = document.getElementById('city');
        const typeElement = document.getElementById('type');
        const carQuantityElement = document.getElementById('carQuantity');
        const carBrandElement = document.getElementById('carBrand');
        const commentElement = document.getElementById('comment');
        
        // Текущий выбранный интегратор
        let selectedIntegratorData = null;
        
        // Загрузка данных заявки для выбранного интегратора
        function loadApplicationData(integratorId) {
            // Проверяем, есть ли данные для этого интегратора
            let applicationData = applicationsByIntegrator[integratorId];
            
            // Если данных нет, создаем случайные
            if (!applicationData) {
                applicationData = generateRandomApplicationData(integratorId);
            }
            
            // Обновляем интерфейс с данными заявки
            updateApplicationUI(applicationData);
            
            // Показываем детали заявки
            applicationEmptyState.style.display = 'none';
            applicationDetails.style.display = 'grid';
        }
        
        // Генерация случайных данных заявки
        function generateRandomApplicationData(integratorId) {
            const cities = ["Москва", "Санкт-Петербург", "Екатеринбург", "Новосибирск", "Казань", "Сочи", "Краснодар"];
            const types = ["Покупка автомобиля", "Аренда автомобиля", "Техническое обслуживание", "Страхование", "Трейд-ин"];
            const brands = ["Toyota", "BMW", "Mercedes-Benz", "Audi", "Volkswagen", "Skoda", "Porsche", "Lexus"];
            const comments = [
                "Клиент интересуется автомобилем с автоматической коробкой передач",
                "Важны экономичность расходов на обслуживание",
                "Нужен автомобиль для семьи с детьми, важна безопасность",
                "Интересуют автомобили с гибридным двигателем",
                "Клиент хочет протестировать автомобиль перед покупкой"
            ];
            
            return {
                dealId: 2400 + Math.floor(Math.random() * 100),
                status: "pending",
                clientBio: `Клиент ID: ${integratorId + 1000}, возраст: ${20 + Math.floor(Math.random() * 40)} лет`,
                clientPhone: `+7 (9${Math.floor(Math.random() * 90) + 10}) ${Math.floor(Math.random() * 900) + 100}-${Math.floor(Math.random() * 90) + 10}-${Math.floor(Math.random() * 90) + 10}`,
                city: cities[Math.floor(Math.random() * cities.length)],
                type: types[Math.floor(Math.random() * types.length)],
                carQuantity: (1 + Math.floor(Math.random() * 3)).toString(),
                carBrand: `${brands[Math.floor(Math.random() * brands.length)]}, ${brands[Math.floor(Math.random() * brands.length)]}`,
                comment: comments[Math.floor(Math.random() * comments.length)]
            };
        }
        
        // Обновление интерфейса с данными заявки
        function updateApplicationUI(applicationData) {
            // Обновляем статус
            const statusText = statusTranslations[applicationData.status] || applicationData.status;
            const statusClass = statusClasses[applicationData.status] || "status-pending";
            
            statusElement.textContent = statusText;
            statusElement.className = `status-badge ${statusClass}`;
            
            // Обновляем остальные поля
            dealIdElement.textContent = applicationData.dealId;
            clientBioElement.textContent = applicationData.clientBio;
            clientPhoneElement.textContent = applicationData.clientPhone;
            cityElement.textContent = applicationData.city;
            typeElement.textContent = applicationData.type;
            carQuantityElement.textContent = applicationData.carQuantity;
            carBrandElement.textContent = applicationData.carBrand;
            commentElement.textContent = applicationData.comment;
        }
        
        // Отображение списка интеграторов
        function displayIntegrators(filter = '') {
            integratorOptions.innerHTML = '';
            
            const filtered = integrators.filter(integrator => {
                const fullName = `${integrator.firstName} ${integrator.lastName}`.toLowerCase();
                return fullName.includes(filter.toLowerCase());
            });
            
            if (filtered.length === 0) {
                const noResults = document.createElement('div');
                noResults.className = 'datalist-option';
                noResults.textContent = 'Интеграторы не найдены';
                integratorOptions.appendChild(noResults);
            } else {
                filtered.forEach(integrator => {
                    const option = document.createElement('div');
                    option.className = 'datalist-option';
                    option.dataset.id = integrator.id;
                    option.dataset.firstName = integrator.firstName;
                    option.dataset.lastName = integrator.lastName;
                    
                    option.innerHTML = `
                        <span class="integrator-name">${integrator.firstName} ${integrator.lastName}</span>
                        <span class="integrator-email">Email: ${integrator.email}</span>
                    `;
                    
                    option.addEventListener('click', () => {
                        selectIntegrator(integrator);
                        integratorSearch.value = `${integrator.firstName} ${integrator.lastName}`;
                        integratorOptions.style.display = 'none';
                    });
                    
                    integratorOptions.appendChild(option);
                });
            }
            
            // Показать список, если есть что показывать и поле поиска не пустое
            if (filtered.length > 0 && filter.length > 0) {
                integratorOptions.style.display = 'block';
            } else {
                integratorOptions.style.display = 'none';
            }
        }
        
        // Выбор интегратора
        function selectIntegrator(integrator) {
            selectedIntegratorData = integrator;
            selectedName.textContent = `${integrator.firstName} ${integrator.lastName}`;
            selectedId.textContent = `ID: ${integrator.id}`;
            selectedAvatar.textContent = `${integrator.firstName.charAt(0)}${integrator.lastName.charAt(0)}`;
            selectedIntegrator.classList.add('show');
            selectButton.disabled = false;
            
            // Загружаем данные заявки для выбранного интегратора
            loadApplicationData(integrator.id);
        }
        
        // Отправка выбранного интегратора на бэкенд
        function submitIntegrator() {
            if (!selectedIntegratorData) return;
            
            // Показываем индикатор загрузки на кнопке
            const originalText = selectButton.innerHTML;
            selectButton.innerHTML = '<div class="loading"></div> Отправка...';
            selectButton.disabled = true;
            
            // В реальном приложении здесь будет fetch запрос к API
            // fetch('/api/assign-integrator', {
            //     method: 'POST',
            //     headers: {
            //         'Content-Type': 'application/json',
            //     },
            //     body: JSON.stringify({
            //         integratorId: selectedIntegratorData.id,
            //         dealId: applicationsByIntegrator[selectedIntegratorData.id]?.dealId || 0
            //     })
            // })
            
            // Имитация запроса к API
            setTimeout(() => {
                // Возвращаем кнопку в исходное состояние
                selectButton.innerHTML = originalText;
                selectButton.disabled = false;
                
                // Показываем уведомление об успехе
                showNotification(`Интегратор ${selectedIntegratorData.firstName} ${selectedIntegratorData.lastName} успешно назначен!`, 'success');
                
                // В реальном приложении здесь может быть обновление интерфейса
                console.log('Отправленные данные:', {
                    integratorId: selectedIntegratorData.id,
                    dealId: applicationsByIntegrator[selectedIntegratorData.id]?.dealId || 0
                });
            }, 1500);
        }
        
        // Показать уведомление
        function showNotification(message, type = 'success') {
            notification.textContent = message;
            notification.className = `notification ${type}`;
            
            setTimeout(() => {
                notification.classList.add('show');
            }, 10);
            
            setTimeout(() => {
                notification.classList.remove('show');
            }, 4000);
        }
        
        // Инициализация страницы
        document.addEventListener('DOMContentLoaded', function() {
            displayIntegrators();
            
            // Обработчик ввода в поле поиска
            integratorSearch.addEventListener('input', function() {
                displayIntegrators(this.value);
                
                // Сбрасываем выбор, если поле очищено
                if (this.value === '') {
                    selectedIntegratorData = null;
                    selectedIntegrator.classList.remove('show');
                    selectButton.disabled = true;
                    
                    // Скрываем данные заявки
                    applicationEmptyState.style.display = 'flex';
                    applicationDetails.style.display = 'none';
                }
            });
            
            // Обработчик фокуса на поле поиска
            integratorSearch.addEventListener('focus', function() {
                if (this.value.length > 0) {
                    displayIntegrators(this.value);
                }
            });
            
            // Скрыть список при клике вне поля
            document.addEventListener('click', function(event) {
                if (!integratorSearch.contains(event.target) && !integratorOptions.contains(event.target)) {
                    integratorOptions.style.display = 'none';
                }
            });
            
            // Обработчик кнопки выбора
            selectButton.addEventListener('click', submitIntegrator);
            
            // Обработчик нажатия Enter в поле поиска
            integratorSearch.addEventListener('keydown', function(event) {
                if (event.key === 'Enter') {
                    event.preventDefault();
                    
                    // Если есть выбранный интегратор, отправляем его
                    if (selectedIntegratorData) {
                        submitIntegrator();
                    }
                }
            });
            
            // Показать тестовое уведомление при загрузке
            setTimeout(() => {
                showNotification('Данные интеграторов успешно загружены', 'success');
            }, 1000);
        });
    </script>
</body>
</html>