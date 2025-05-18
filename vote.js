  // Змінні для зберігання інформації про користувача
  let currentUserGroupId;
  let currentUserStatus;
  
  // Константи
  const API_BASE_URL = 'https://registration-io.onrender.com';
  const BLOCKCHAIN_API_URL = 'https://blockchain-io-ffel.onrender.com';
  const STORAGE_KEYS = {
    TOKEN: 'session_token',
    GROUP_ID: 'user_group_id',
    STATUS: 'user_status'
  };
  
  // Перевірка статусу користувача при завантаженні сторінки
  async function checkUserStatus() {
    try {
      const token = localStorage.getItem(STORAGE_KEYS.TOKEN);
      
      if (!token) {
        console.error("Немає токена для авторизації.");
        window.location.href = "login.html"; // Перенаправляємо на сторінку входу
        return;
      }
      
      const response = await fetch(`${API_BASE_URL}/check-auth`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${token}`,
        },
      });
      
      if (!response.ok) {
        if (response.status === 401) {
          console.warn("Токен недійсний або прострочений. Виконується вихід...");
          logout();
        }
        throw new Error('Помилка перевірки авторизації');
      }
      
      const data = await response.json();
      console.log("Статус користувача:", data.status);
      console.log("Група користувача:", data.groupId);
      
      // Зберігаємо ID групи та статус користувача
      currentUserGroupId = data.groupId;
      currentUserStatus = data.status;
      
      // Показуємо кнопку додавання тільки для адміністраторів
      if (data.status === "admin") {
        document.getElementById('add-vote-btn').style.display = 'inline-block';
      }
      
      return data;
    } catch (error) {
      console.error("Помилка перевірки статусу користувача:", error);
      logout();
      return null;
    }
  }

  // Функція для завантаження голосувань
  async function fetchVotes(searchQuery = '') {
    // Показуємо спінери завантаження
    document.getElementById('group-vote-list').innerHTML = '<div class="loading-spinner"></div>';
    document.getElementById('public-vote-list').innerHTML = '<div class="loading-spinner"></div>';
    
    try {
      const userInfo = await checkUserStatus();
      if (!userInfo) return;
      
      // Передаємо groupId користувача для фільтрації на сервері
      const response = await fetch(`${BLOCKCHAIN_API_URL}/chain?groupId=${userInfo.groupId || 'none'}`);
      const blocks = await response.json();

      // Очищаємо контейнери голосувань
      const groupContainer = document.getElementById('group-vote-list');
      const publicContainer = document.getElementById('public-vote-list');
      groupContainer.innerHTML = '';
      publicContainer.innerHTML = '';

      if (!Array.isArray(blocks) || blocks.length === 0) {
        groupContainer.innerHTML = "<div class='empty-results'>Наразі немає активних групових голосувань.</div>";
        publicContainer.innerHTML = "<div class='empty-results'>Наразі немає активних публічних голосувань.</div>";
        return;
      }

      // Фільтруємо блоки для відображення лише голосувань типу "create_vote"
      const voteBlocks = blocks.filter(block => block.type === 'create_vote');

      // Якщо є запит на пошук, фільтруємо голосування по введеному тексту
      const filteredVotes = voteBlocks.filter(block => {
        if (!searchQuery) return true;
        
        const lowerSearchQuery = searchQuery.toLowerCase();
        return block.title.toLowerCase().includes(lowerSearchQuery) ||
               block.description.toLowerCase().includes(lowerSearchQuery);
      });

      if (filteredVotes.length === 0) {
        groupContainer.innerHTML = "<div class='empty-results'>Немає групових голосувань, що відповідають пошуку.</div>";
        publicContainer.innerHTML = "<div class='empty-results'>Немає публічних голосувань, що відповідають пошуку.</div>";
        return;
      }

      // Перевіряємо, які голосування ще активні
      const now = new Date();
      const activeVotes = filteredVotes.filter(vote => new Date(vote.endDate) > now);
      
      // Завантажуємо вже зроблені голоси користувача для відображення стану
      const userId = await getUserId();
      const userVotesResponse = await fetch(`${BLOCKCHAIN_API_URL}/chain`);
      const allBlocks = await userVotesResponse.json();
      const userVotes = allBlocks.filter(block => 
        block.type === "vote" && block.voterId === userId
      );
      
      // Створюємо мапу голосувань користувача для швидкого пошуку
      const userVotesMap = {};
      userVotes.forEach(vote => {
        userVotesMap[vote.voteId] = vote.candidate;
      });
      
      // Розділяємо на групові і публічні голосування
      const groupVotes = activeVotes.filter(vote => 
        Array.isArray(vote.groupIds) && 
        !vote.groupIds.includes("all") && 
        vote.groupIds.includes(userInfo.groupId)
      );
      
      const publicVotes = activeVotes.filter(vote => 
        Array.isArray(vote.groupIds) && 
        vote.groupIds.includes("all")
      );

      // Додаємо групові голосування в DOM
      if (groupVotes.length === 0) {
        groupContainer.innerHTML = "<div class='empty-results'>Наразі немає активних групових голосувань.</div>";
      } else {
        groupVotes.forEach(voteBlock => {
          const userVote = userVotesMap[voteBlock.voteId];
          addVoteCard(voteBlock, groupContainer, userVote);
        });
      }
      
      // Додаємо публічні голосування в DOM
      if (publicVotes.length === 0) {
        publicContainer.innerHTML = "<div class='empty-results'>Наразі немає активних публічних голосувань.</div>";
      } else {
        publicVotes.forEach(voteBlock => {
          const userVote = userVotesMap[voteBlock.voteId];
          addVoteCard(voteBlock, publicContainer, userVote);
        });
      }
    } catch (error) {
      console.error('Помилка завантаження голосувань:', error);
      document.getElementById('group-vote-list').innerHTML = 
        "<div class='empty-results'>Помилка при завантаженні даних. Перевірте, чи запущений сервер.</div>";
      document.getElementById('public-vote-list').innerHTML = 
        "<div class='empty-results'>Помилка при завантаженні даних. Перевірте, чи запущений сервер.</div>";
    }
  }
  
  // Функція для додавання карточки голосування в контейнер
 function addVoteCard(voteBlock, container, userVote = null) {
  const card = document.createElement('div');
  card.className = 'card';
  
  // Додаємо клас, якщо користувач вже проголосував
  if (userVote) {
    card.classList.add('already-voted');
  }

  // Форматуємо дату завершення
  const endDate = new Date(voteBlock.endDate).toLocaleDateString('uk-UA', {
    year: 'numeric', 
    month: 'long', 
    day: 'numeric'
  });

  // Визначаємо, скільки часу залишилось
  const now = new Date();
  const endDateTime = new Date(voteBlock.endDate);
  const timeLeft = getTimeLeft(now, endDateTime);

  // Створюємо кнопки для вибору кандидатів/варіантів
  let optionsHtml = '';
  
  if (userVote) {
    // Якщо користувач вже проголосував, показуємо його вибір
    optionsHtml = `
      <div class="vote-complete">
        <p><i class="fas fa-check-circle"></i> Ви проголосували за: <strong>${userVote}</strong></p>
      </div>
    `;
  } else {
    // Показуємо кнопки для голосування всім користувачам (і звичайним, і адміністраторам)
    optionsHtml = voteBlock.options.map(option =>
      `<button class="vote-btn" onclick="sendVote('${voteBlock.voteId}', '${option}')">${option}</button>`
    ).join("");
  }

  // Створюємо шаблон картки з заголовком та вмістом
  card.innerHTML = `
    <div class="card-header">
      <h3>${voteBlock.title}</h3>
      <div class="vote-time-left">${timeLeft}</div>
    </div>
    <div class="card-content">
      <div class="card-left">
        <p class="vote-id">ID: ${voteBlock.voteId}</p>
        <p class="description">${voteBlock.description}</p>
        <p class="end-date">Голосування до: ${endDate}</p>
      </div>
      <div class="card-right">
        ${optionsHtml}
      </div>
    </div>
  `;

  container.appendChild(card);
}

  // Функція для отримання залишку часу у зручному форматі
  function getTimeLeft(now, endDate) {
    const diff = endDate - now;
    
    if (diff <= 0) {
      return "Завершено";
    }
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    
    if (days > 0) {
      return `${days} д. ${hours} год.`;
    } else if (hours > 0) {
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      return `${hours} год. ${minutes} хв.`;
    } else {
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      return `${minutes} хв. ${seconds} сек.`;
    }
  }

  // Функція для отримання ID користувача
  async function getUserId() {
    const token = localStorage.getItem(STORAGE_KEYS.TOKEN);

    if (!token) {
      console.error("Немає токена для авторизації.");
      return null;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/user-id`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          console.warn("Токен недійсний або прострочений. Виконується вихід...");
          logout();
        }
        throw new Error('Помилка при отриманні id користувача');
      }

      const data = await response.json();
      return data.userId;
    } catch (error) {
      console.error("Помилка отримання id користувача:", error);
      return null;
    }
  }

  // Функція для відправки голосу
  async function sendVote(voteId, candidate) {
  try {
    // Показуємо індикатор завантаження
    showLoadingOverlay();
    
    // Перевіряємо, чи користувач не є адміністратором
    if (currentUserStatus === "admin") {
      hideLoadingOverlay();
      // Показуємо модальне вікно з повідомленням для адміністратора
      showAdminVoteModal();
      return;
    }
    
    // Отримуємо userId через токен
    const userId = await getUserId();
    
    if (!userId) {
      hideLoadingOverlay();
      alert("Не вдалося отримати id користувача.");
      return;
    }

    const voteData = { voteId, candidate, voterId: userId };

    const response = await fetch(`${BLOCKCHAIN_API_URL}/vote`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(voteData)
    });

    const data = await response.json();
    hideLoadingOverlay();

    if (data.error) {
      alert(data.error);
    } else {
      alert("Голос успішно відправлено!");
      // Оновлюємо список голосувань
      fetchVotes(document.getElementById('search-input').value.trim());
    }
  } catch (error) {
    hideLoadingOverlay();
    console.error('Помилка при відправці голосу:', error);
    alert("Помилка при відправці голосу. Спробуйте пізніше.");
  }
}

// Функція для показу модального вікна з повідомленням для адміністратора
function showAdminVoteModal() {
  // Перевіряємо, чи існує модальне вікно, якщо ні — створюємо його
  let adminModal = document.getElementById('admin-vote-modal');
  
  if (!adminModal) {
    // Створюємо модальне вікно
    adminModal = document.createElement('div');
    adminModal.id = 'admin-vote-modal';
    adminModal.className = 'modal';
    
    // Створюємо вміст модального вікна
    adminModal.innerHTML = `
      <div class="modal-content">
        <span class="close" onclick="closeAdminVoteModal()">&times;</span>
        <div class="admin-vote-message">
          <i class="fas fa-exclamation-circle"></i>
          <h3>Неможливо проголосувати</h3>
          <p>Як адміністратор, ви не можете брати участь у голосуванні.</p>
          <p>Ви можете створювати та керувати голосуваннями.</p>
          <button onclick="closeAdminVoteModal()" class="admin-vote-btn">Зрозуміло</button>
        </div>
      </div>
    `;
    
    // Додаємо модальне вікно на сторінку
    document.body.appendChild(adminModal);
  }
  
  // Показуємо модальне вікно
  adminModal.style.display = 'flex';
}

// Функція для закриття модального вікна
function closeAdminVoteModal() {
  const adminModal = document.getElementById('admin-vote-modal');
  if (adminModal) {
    adminModal.style.display = 'none';
  }
}

  // Функція для виходу з системи
  function logout() {
    localStorage.removeItem(STORAGE_KEYS.TOKEN);
    localStorage.removeItem(STORAGE_KEYS.GROUP_ID);
    localStorage.removeItem(STORAGE_KEYS.STATUS);
    window.location.href = "login.html";
  }

  // Функція для відкриття форми додавання голосування
  function openAddVoteForm() {
    document.getElementById('form-container').style.display = 'flex';
    
    // Встановлюємо мінімальну дату - сьогодні
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('vote-end-date').min = today;
    
    // Встановлюємо значення за замовчуванням - через 30 днів від сьогодні
    const defaultEndDate = new Date();
    defaultEndDate.setDate(defaultEndDate.getDate() + 30);
    document.getElementById('vote-end-date').value = defaultEndDate.toISOString().split('T')[0];
    
    // Встановлюємо значення за замовчуванням для групи - поточна група адміністратора
    if (currentUserGroupId) {
      document.getElementById('vote-group-ids').value = currentUserGroupId;
    }
  }

  // Функція для закриття форми
  function closeAddVoteForm() {
    document.getElementById('form-container').style.display = 'none';
  }

  // Функція для перемикання між вкладками
  function switchTab(tabName) {
    // Активація кнопки вкладки
    const tabs = document.querySelectorAll('.tab-btn');
    tabs.forEach(tab => {
      if (tab.getAttribute('data-tab') === tabName) {
        tab.classList.add('active');
      } else {
        tab.classList.remove('active');
      }
    });
    
    // Відображення контейнера вкладки
    const containers = document.querySelectorAll('.votes-container');
    containers.forEach(container => {
      if (container.id === `${tabName}-votes`) {
        container.classList.add('active');
      } else {
        container.classList.remove('active');
      }
    });
  }

  // Функція для показу завантаження
  function showLoadingOverlay() {
    const overlay = document.createElement('div');
    overlay.id = 'loading-overlay';
    overlay.innerHTML = '<div class="loading-spinner"></div>';
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background-color: rgba(0, 0, 0, 0.5);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 9999;
    `;
    document.body.appendChild(overlay);
  }

  // Функція для приховування завантаження
  function hideLoadingOverlay() {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) {
      document.body.removeChild(overlay);
    }
  }

  // Ініціалізація сторінки
  document.addEventListener('DOMContentLoaded', async () => {
    // Завантажуємо голосування
    fetchVotes();
    
    // Додаємо обробники подій
    document.getElementById('add-vote-btn').addEventListener('click', openAddVoteForm);
    
    // Обробник для закриття форми по кліку поза нею
    document.getElementById('form-container').addEventListener('click', (e) => {
      if (e.target === document.getElementById('form-container')) {
        closeAddVoteForm();
      }
    });
    
    // Обробник для пошуку
    document.getElementById('search-btn').addEventListener('click', () => {
      const searchQuery = document.getElementById('search-input').value.trim();
      fetchVotes(searchQuery);
    });
    
    // Обробник для пошуку при натисканні Enter
    document.getElementById('search-input').addEventListener('keyup', (e) => {
      if (e.key === 'Enter') {
        const searchQuery = document.getElementById('search-input').value.trim();
        fetchVotes(searchQuery);
      }
    });
    
    // Обробники для вкладок
    document.querySelectorAll('.tab-btn').forEach(tab => {
      tab.addEventListener('click', () => {
        switchTab(tab.getAttribute('data-tab'));
      });
    });
    
    // Обробка події для додавання нового голосування
    document.getElementById('vote-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      
      // Показуємо індикатор завантаження
      showLoadingOverlay();

      const title = document.getElementById('vote-title').value;
      const description = document.getElementById('vote-description').value;
      const options = document.getElementById('vote-options').value.split(',').map(option => option.trim());
      const voteId = String(Date.now()); // Генеруємо унікальний voteId на основі поточного часу
      
      // Отримуємо обрану дату завершення голосування
      const endDateValue = document.getElementById('vote-end-date').value;
      const endDate = new Date(endDateValue + 'T23:59:59'); // Встановлюємо час закінчення на кінець дня
      
      // Отримуємо ID груп
      const groupIdsInput = document.getElementById('vote-group-ids').value.trim();
      let groupIds;
      
      if (groupIdsInput === '') {
        groupIds = ["all"]; // За замовчуванням - публічне голосування
      } else if (groupIdsInput.toLowerCase() === 'all') {
        groupIds = ["all"];
      } else {
        groupIds = groupIdsInput.split(',').map(id => id.trim()).filter(id => id);
      }
      
      // Перевіряємо, чи дата закінчення в майбутньому
      const now = new Date();
      if (endDate <= now) {
        hideLoadingOverlay();
        alert("Дата завершення голосування повинна бути в майбутньому.");
        return;
      }
      
      // Перевіряємо, чи є хоча б два варіанти для голосування
      if (options.length < 2) {
        hideLoadingOverlay();
        alert("Потрібно щонайменше два варіанти для голосування");
        return;
      }

      try {
        // Отримуємо ID користувача
        const userId = await getUserId();
        
        if (!userId) {
          hideLoadingOverlay();
          alert("Не вдалося отримати інформацію про користувача.");
          return;
        }

        // Перевіряємо, чи користувач має права адміністратора
        if (currentUserStatus !== "admin") {
          hideLoadingOverlay();
          alert("У вас немає прав для створення голосувань.");
          return;
        }

        const newVote = { 
          voteId, 
          title, 
          description, 
          options, 
          creatorId: userId,
          endDate: endDate.toISOString(),
          groupIds: groupIds // Додаємо ID груп
        };

        const response = await fetch(`${BLOCKCHAIN_API_URL}/create_vote`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newVote),
        });

        const data = await response.json();
        hideLoadingOverlay();
        
        if (data.message && data.message.includes("створено")) {
          alert('Голосування успішно додано!');
          closeAddVoteForm();
          
          // Очищаємо форму
          document.getElementById('vote-title').value = '';
          document.getElementById('vote-description').value = '';
          document.getElementById('vote-options').value = '';
          document.getElementById('vote-group-ids').value = currentUserGroupId || '';
          
          // Оновлення списку голосувань
          fetchVotes();
        } else {
          alert(data.error || 'Помилка при додаванні голосування');
        }
      } catch (error) {
        hideLoadingOverlay();
        console.error('Помилка при додаванні голосування:', error);
        alert('Помилка при додаванні голосування. Спробуйте пізніше');
      }
    });
    
    // Обробник для закриття модального вікна при кліку поза його вмістом
document.addEventListener('click', function(event) {
  const adminModal = document.getElementById('admin-vote-modal');
  if (adminModal && event.target === adminModal) {
    closeAdminVoteModal();
  }
});

// Обробник для закриття модального вікна при натисканні клавіші Escape
document.addEventListener('keydown', function(event) {
  if (event.key === 'Escape') {
    closeAdminVoteModal();
  }
});
    // Додаємо обробник автооновлення голосувань кожні 60 секунд
    setInterval(() => {
      fetchVotes(document.getElementById('search-input').value.trim());
    }, 60000);
  });
