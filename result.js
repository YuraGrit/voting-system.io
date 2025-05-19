  // Константи
  const API_BASE_URL = 'https://registration-io.onrender.com';
  const BLOCKCHAIN_API_URL = 'https://blockchain-io-ffel.onrender.com';
  const STORAGE_KEYS = {
    TOKEN: 'session_token',
    GROUP_ID: 'user_group_id',
    STATUS: 'user_status'
  };
  
  // Колірна схема для діаграми
  const CHART_COLORS = [
    '#4caf50', // зелений
    '#ff9800', // оранжевий
    '#f44336', // червоний
    '#2196f3', // синій
    '#9c27b0', // фіолетовий
    '#009688', // бірюзовий
    '#ffeb3b', // жовтий
    '#795548', // коричневий
    '#607d8b'  // сіро-синій
  ];
  
  // Змінні стану
  let allVoteData = [];
  let filteredVoteData = [];
  let currentUserGroupId = null;
  
  // Перевіряємо авторизацію при завантаженні сторінки
  document.addEventListener('DOMContentLoaded', function() {
    // Перевірка наявності токена
    const token = localStorage.getItem(STORAGE_KEYS.TOKEN);
    if (!token) {
      window.location.href = 'login';
      return;
    }
    
    // Отримуємо інформацію про користувача і його групу
    checkUserStatus().then(() => {
      // Завантажуємо результати після отримання інформації про користувача
      fetchResults();
    });
    
    // Додаємо обробники подій для фільтрів
    document.getElementById('vote-status').addEventListener('change', () => {
      applyFilters().catch(error => console.error('Помилка при застосуванні фільтрів:', error));
    });
    document.getElementById('vote-type').addEventListener('change', () => {
      applyFilters().catch(error => console.error('Помилка при застосуванні фільтрів:', error));
    });
    document.getElementById('search-input').addEventListener('input', () => {
      applyFilters().catch(error => console.error('Помилка при застосуванні фільтрів:', error));
    });
    document.getElementById('reset-filters').addEventListener('click', resetFilters);
    
    // Автооновлення даних кожні 30 секунд
    setInterval(fetchResults, 30000);
  });
  
  // Функція для перевірки статусу користувача
  async function checkUserStatus() {
    try {
      const token = localStorage.getItem(STORAGE_KEYS.TOKEN);
      
      if (!token) {
        console.error("Немає токена для авторизації.");
        window.location.href = "login";
        return null;
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
      localStorage.setItem(STORAGE_KEYS.GROUP_ID, data.groupId);
      localStorage.setItem(STORAGE_KEYS.STATUS, data.status);
      
      return data;
    } catch (error) {
      console.error("Помилка перевірки статусу користувача:", error);
      logout();
      return null;
    }
  }
  
  // Функція для виходу з системи
  function logout() {
    localStorage.removeItem(STORAGE_KEYS.TOKEN);
    localStorage.removeItem(STORAGE_KEYS.GROUP_ID);
    localStorage.removeItem(STORAGE_KEYS.STATUS);
    window.location.href = "login";
  }
  
  // Функція для отримання ID користувача
  async function getUserId() {
    const token = localStorage.getItem(STORAGE_KEYS.TOKEN);

    if (!token) {
      console.error("Немає токена для авторизації.");
      window.location.href = "login";
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
          console.warn("Токен недійсний або прострочений. Перенаправлення на сторінку входу...");
          localStorage.removeItem(STORAGE_KEYS.TOKEN);
          window.location.href = "login";
        }
        throw new Error('Помилка при отриманні ID користувача');
      }

      const data = await response.json();
      return data.userId;
    } catch (error) {
      console.error("Помилка отримання ID користувача:", error);
      return null;
    }
  }

  // Функція для отримання результатів голосування
  async function fetchResults() {
    // Показуємо індикатор завантаження
    document.getElementById('cards-container').innerHTML = '<div class="loading-spinner"></div>';
    
    try {
      const userId = await getUserId();
      if (!userId) {
        document.getElementById('cards-container').innerHTML = 
          '<div class="empty-results">Неможливо визначити користувача. Будь ласка, увійдіть в систему.</div>';
        return;
      }
      
      // Якщо не маємо інформації про групу, спробуємо отримати її
      if (!currentUserGroupId) {
        await checkUserStatus();
      }

      const response = await fetch(`${BLOCKCHAIN_API_URL}/chain`);
      const blocks = await response.json();

      // Фільтруємо блоки голосувань та блоки з голосами
      const voteCreations = blocks.filter(block => block.type === "create_vote");
      const votes = blocks.filter(block => block.type === "vote");

      // Знаходимо голоси поточного користувача
      const userVotes = votes.filter(vote => vote.voterId === userId);
      
      // Отримуємо ID голосувань, в яких брав участь користувач
      const userVoteIds = [...new Set(userVotes.map(vote => vote.voteId))];

      // Оновлюємо лічильник голосувань користувача
      document.getElementById('user-vote-count').textContent = userVoteIds.length;

      // Якщо взагалі немає голосувань
      if (voteCreations.length === 0) {
        document.getElementById('cards-container').innerHTML = 
          '<div class="empty-results">Немає доступних голосувань.</div>';
        document.getElementById('vote-count-badge').innerHTML = 
          '<i class="fas fa-poll"></i> 0 голосувань';
        return;
      }

      // Фільтруємо голосування, до яких користувач має доступ
      const userGroupId = localStorage.getItem(STORAGE_KEYS.GROUP_ID);
      const accessibleVotes = voteCreations.filter(vote => {
        // Перевіряємо, чи голосування публічне або належить до групи користувача
        return (vote.groupIds && vote.groupIds.includes("all")) || 
               (userGroupId && vote.groupIds && vote.groupIds.includes(userGroupId));
      });

      // Оновлюємо лічильник голосувань, доступних користувачу
      document.getElementById('vote-count-badge').innerHTML = 
        `<i class="fas fa-poll"></i> <span class="vote-count-badge">${accessibleVotes.length}</span> голосувань`;

      // Створення структури для результатів голосування
      const voteInfo = {};

      // Збираємо інформацію про голосування
      voteCreations.forEach(vote => {
        voteInfo[vote.voteId] = {
          title: vote.title,
          description: vote.description,
          endDate: new Date(vote.endDate),
          options: vote.options || [],
          groupIds: vote.groupIds || [],
          isPublic: vote.groupIds && vote.groupIds.includes("all"),
          creationDate: new Date(vote.creationDate || vote.timestamp),
          creatorId: vote.creatorId,
          voteResults: {},
          userVote: null,
          totalVotes: 0
        };
        
        // Ініціалізуємо лічильники голосів для кожного варіанту
        vote.options.forEach(option => {
          voteInfo[vote.voteId].voteResults[option] = 0;
        });
      });

      // Підрахунок голосів для кожного голосування
      votes.forEach(vote => {
        const { voteId, candidate, voterId } = vote;
        
        // Пропускаємо голосування, які не існують у voteInfo
        if (!voteInfo[voteId]) return;

        // Збільшуємо лічильник для відповідного варіанту
        if (voteInfo[voteId].voteResults[candidate] !== undefined) {
          voteInfo[voteId].voteResults[candidate]++;
        }
        
        // Збільшуємо загальну кількість голосів
        voteInfo[voteId].totalVotes++;
        
        // Зберігаємо голос поточного користувача
        if (voterId === userId) {
          voteInfo[voteId].userVote = candidate;
        }
      });
      
      // Знаходимо переможний варіант для кожного голосування
      Object.keys(voteInfo).forEach(voteId => {
        const results = voteInfo[voteId].voteResults;
        let maxVotes = 0;
        let winner = null;
        
        Object.entries(results).forEach(([option, count]) => {
          if (count > maxVotes) {
            maxVotes = count;
            winner = option;
          }
        });
        
        voteInfo[voteId].winner = winner;
      });
      
      // Перетворюємо об'єкт у масив для сортування
      allVoteData = Object.entries(voteInfo).map(([voteId, info]) => {
        return { voteId, ...info };
      });
      
      // Застосовуємо фільтри
      await applyFilters();
    } catch (err) {
      console.error('Помилка при отриманні результатів:', err);
      document.getElementById('cards-container').innerHTML = 
        '<div class="empty-results">Помилка при завантаженні даних. Перевірте, чи запущений сервер.</div>';
    }
  }
  
  // Функція для застосування фільтрів
  async function applyFilters() {
    const statusFilter = document.getElementById('vote-status').value;
    const typeFilter = document.getElementById('vote-type').value;
    const searchQuery = document.getElementById('search-input').value.toLowerCase();
    const now = new Date();
    
    // Отримуємо ID групи поточного користувача
    let userGroupId = localStorage.getItem(STORAGE_KEYS.GROUP_ID);
    
    // Якщо ID групи не знайдено в localStorage, отримуємо його через API
    if (!userGroupId) {
      try {
        const userInfo = await checkUserStatus();
        if (userInfo) {
          userGroupId = userInfo.groupId;
        }
      } catch (error) {
        console.error("Помилка при отриманні групи користувача:", error);
      }
    }
    
    // Фільтруємо дані
    filteredVoteData = allVoteData.filter(vote => {
      // Фільтр за статусом
      const isActive = vote.endDate > now;
      if (statusFilter === 'active' && !isActive) return false;
      if (statusFilter === 'completed' && isActive) return false;
      
      // Фільтр за типом
      if (typeFilter === 'public' && !vote.isPublic) return false;
      if (typeFilter === 'group' && vote.isPublic) return false;
      
      // Додаткова перевірка для групових голосувань
      // Показуємо тільки ті групові голосування, які належать до групи користувача
      if (!vote.isPublic && Array.isArray(vote.groupIds) && !vote.groupIds.includes("all")) {
        if (!userGroupId || !vote.groupIds.includes(userGroupId)) {
          return false;
        }
      }
      
      // Фільтр за пошуком
      if (searchQuery && !vote.title.toLowerCase().includes(searchQuery)) return false;
      
      return true;
    });
    
    // Сортування: спочатку активні, потім завершені, в кожній групі за датою створення (новіші спочатку)
    filteredVoteData.sort((a, b) => {
      const isActiveA = a.endDate > now;
      const isActiveB = b.endDate > now;
      
      if (isActiveA !== isActiveB) {
        return isActiveB - isActiveA; // Спочатку активні
      }
      
      // Якщо обидва активні або обидва неактивні, сортуємо за датою створення
      return b.creationDate - a.creationDate;
    });
    
    // Відображаємо результати
    renderResults();
  }
  
  // Функція для скидання фільтрів
  async function resetFilters() {
    document.getElementById('vote-status').value = 'all';
    document.getElementById('vote-type').value = 'all';
    document.getElementById('search-input').value = '';
    
    // Застосовуємо фільтри
    await applyFilters();
  }
  
  // Функція для відображення результатів голосування
  function renderResults() {
    const container = document.getElementById('cards-container');
    container.innerHTML = '';
    
    if (filteredVoteData.length === 0) {
      container.innerHTML = '<div class="no-data-message">Немає голосувань, що відповідають вашим критеріям пошуку.</div>';
      return;
    }
    
    // Перебираємо всі голосування
    filteredVoteData.forEach(vote => {
      const now = new Date();
      const isActive = vote.endDate > now;
      
      // Створюємо картку для голосування
      const card = document.createElement('div');
      card.className = 'card';
      
      // Додаємо підсвічування для голосувань, в яких взяв участь користувач
      if (vote.userVote) {
        card.classList.add('highlight');
      }
      
      // Визначаємо тип голосування (публічне чи групове)
      const voteTypeClass = vote.isPublic ? 'type-public' : 'type-group';
      const voteType = vote.isPublic ? 'Публічне' : 'Групове';
      
      // Створюємо HTML для заголовку картки з міткою типу голосування
      const cardHeaderHTML = `
        <div class="card-header">
          <h3>${vote.title}</h3>
          <div class="status-wrapper">
            <span class="status ${isActive ? 'status-active' : 'status-completed'}">${isActive ? 'Активне' : 'Завершено'}</span>
            <span class="vote-type ${voteTypeClass}">${voteType}</span>
          </div>
        </div>
      `;
      
      // Створюємо візуалізацію результатів голосування
      const resultsData = [];
      let totalVotes = vote.totalVotes;
      
      // Підготовка даних для графіків
      Object.entries(vote.voteResults).forEach(([option, count], index) => {
        const percentage = totalVotes > 0 ? (count / totalVotes) * 100 : 0;
        const isWinner = option === vote.winner;
        const isUserVote = option === vote.userVote;
        
        resultsData.push({ 
          option, 
          count, 
          percentage, 
          color: CHART_COLORS[index % CHART_COLORS.length],
          isWinner,
          isUserVote
        });
      });
      
      // Сортуємо результати за кількістю голосів (від більшого до меншого)
      resultsData.sort((a, b) => b.count - a.count);
      
      // Створюємо HTML для прогрес-барів результатів
      const resultsHTML = resultsData.map((result, index) => {
        const { option, count, percentage, color, isWinner, isUserVote } = result;
        
        // Додаємо стилі для переможця та голосу користувача
        const optionClasses = [];
        if (isWinner) optionClasses.push('winner-option');
        if (isUserVote) optionClasses.push('user-vote-option');
        
        return `
          <div class="progress-container ${optionClasses.join(' ')}">
            <div class="progress-label">
              <span>${option} ${isWinner ? '<i class="fas fa-trophy winner-icon"></i>' : ''} ${isUserVote ? '<i class="fas fa-check-circle user-vote-icon"></i>' : ''}</span>
              <span>${count} голосів (${percentage.toFixed(1)}%)</span>
            </div>
            <div class="progress-bar">
              <div class="progress-fill" style="width: ${percentage}%; background-color: ${color}"></div>
            </div>
          </div>
        `;
      }).join('');
      
      // Створюємо HTML для вмісту картки
      const cardContentHTML = `
        <div class="card-content">
          <div class="card-info">
            <p class="vote-id">ID: ${vote.voteId}</p>
            <p class="description">${vote.description}</p>
            <p class="end-date">Дата завершення: ${vote.endDate.toLocaleDateString('uk-UA', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
            ${vote.userVote ? `<p class="user-vote">Ваш голос: <strong>${vote.userVote}</strong></p>` : ''}
          </div>
          <div class="card-results">
            ${resultsHTML}
            <div class="total-votes">
              <strong>Загальна кількість голосів: ${totalVotes}</strong>
            </div>
          </div>
        </div>
      `;
      
      // Об'єднуємо заголовок і вміст
      card.innerHTML = cardHeaderHTML + cardContentHTML;
      
      // Додаємо картку до контейнера
      container.appendChild(card);
    });
  }
  
  // Отримання кольору для діаграми
  function getChartColor(index) {
    return CHART_COLORS[index % CHART_COLORS.length];
  }
