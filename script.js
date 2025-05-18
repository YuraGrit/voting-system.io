/**
 * script.js - Основний скрипт для головної сторінки
 */

// Константи і конфігурація
const API_BASE_URL = 'https://registration-io.onrender.com';
const BLOCKCHAIN_API_URL = 'https://blockchain-io-ffel.onrender.com';
const STORAGE_KEYS = {
  TOKEN: 'session_token',
  GROUP_ID: 'user_group_id',
  STATUS: 'user_status'
};

// Стан додатку
let userData = null;
let lastVoteData = null;

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

// Перевірка авторизації при завантаженні сторінки
window.onload = async function () {
  const token = localStorage.getItem(STORAGE_KEYS.TOKEN);

  if (!token) {
    // Перенаправлення на сторінку авторизації
    redirectToLogin();
    return;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/check-auth`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${token}`
      }
    });

    if (!response.ok) {
      throw new Error("Невалідний токен");
    }

    // Якщо авторизація успішна, отримуємо дані користувача
    getUserData();

  } catch (error) {
    console.error("❌ Авторизація не пройдена:", error);
    logout();
  }
};

/**
 * Отримання даних користувача
 */
async function getUserData() {
  const token = localStorage.getItem(STORAGE_KEYS.TOKEN);

  if (!token) {
    console.error("Немає токена для авторизації.");
    return;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/user`, {
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
      throw new Error('Помилка при отриманні даних користувача');
    }

    userData = await response.json();
    console.log("Отримані дані користувача:", userData);
    
    // Завантажуємо дані про останнє голосування, але не відображаємо їх
    fetchLastVoteData(); 
  } catch (error) {
    console.error("Помилка отримання даних користувача:", error);
  }
}

/**
 * Показати профіль користувача
 */
function showProfile() {
  if (!userData) {
    return;
  }
  
  // Форматуємо статус для відображення (перша літера велика)
  const formattedStatus = userData.status ? 
    userData.status.charAt(0).toUpperCase() + userData.status.slice(1) : 
    'Користувач';
  
  const profileContent = `
    <div class="info">
      <span>Ім'я користувача:</span>
      <p>${userData.username}</p>
    </div>
    <div class="info">
      <span>ID користувача:</span>
      <p>${userData.userId || 'Недоступно'}</p>
    </div>
    <div class="info">
      <span>ID групи:</span>
      <p>${userData.groupId || 'Недоступно'}</p>
    </div>
    <div class="info">
      <span>Статус:</span>
      <p>${formattedStatus}</p>
    </div>
    <button onclick="logout()">Вийти</button>
  `;

  document.getElementById('profileContent').innerHTML = profileContent;
  document.getElementById('profileModal').style.display = "block";
}

/**
 * Закрити профіль
 */
function closeProfile() {
  document.getElementById('profileModal').style.display = "none";
}

/**
 * Показати модальне вікно з результатами останнього голосування
 */
function showLastVoteModal() {
  // Якщо дані вже були завантажені, просто показуємо їх
  if (lastVoteData) {
    renderLastVoteResults();
  } else {
    // Інакше, спробуємо завантажити їх знову
    fetchLastVoteData();
  }
  
  document.getElementById('lastVoteModal').style.display = "block";
}

/**
 * Закрити вікно результатів останнього голосування
 */
function closeLastVoteModal() {
  document.getElementById('lastVoteModal').style.display = "none";
}

/**
 * Закриття модальних вікон при кліку поза ними
 */
window.onclick = function(event) {
  const profileModal = document.getElementById('profileModal');
  const lastVoteModal = document.getElementById('lastVoteModal');
  
  if (event.target == profileModal) {
    closeProfile();
  }
  
  if (event.target == lastVoteModal) {
    closeLastVoteModal();
  }
};

/**
 * Навігаційні функції для переходу між сторінками
 */
function goToVotePage() {
  window.location.href = "vote.html";
}

function goToResultPage() {
  window.location.href = "result.html";
}

function goToReturnPage() {
  window.location.href = "return.html";
}

/**
 * Вихід з системи
 */
function logout() {
  localStorage.removeItem(STORAGE_KEYS.TOKEN);
  localStorage.removeItem(STORAGE_KEYS.GROUP_ID);
  localStorage.removeItem(STORAGE_KEYS.STATUS);
  redirectToLogin();
}

/**
 * Перенаправлення на сторінку логіну
 */
function redirectToLogin() {
  window.location.href = "login.html";
}

/**
 * Отримання ID користувача
 * @returns {Promise<string|null>} ID користувача або null у випадку помилки
 */
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
    console.log("Отримано userId:", data.userId);
    return data.userId;
  } catch (error) {
    console.error("Помилка отримання id користувача:", error);
    return null;
  }
}

/**
 * Отримання кольору для діаграми
 * @param {number} index - Індекс кольору
 * @returns {string} Колір у форматі HEX
 */
function getChartColor(index) {
  return CHART_COLORS[index % CHART_COLORS.length];
}

/**
 * Генерація CSS для conic-gradient на основі даних голосування
 * @param {Object} optionData - Дані про опції голосування
 * @returns {string} CSS значення для conic-gradient
 */
function generateConicGradient(optionData) {
  let gradient = 'conic-gradient(';
  let startPercentage = 0;
  
  Object.entries(optionData).forEach(([option, data], index) => {
    const color = data.color;
    const percentage = data.percentage;
    const endPercentage = startPercentage + percentage;
    
    gradient += `${color} ${startPercentage}% ${endPercentage}%`;
    
    if (index < Object.keys(optionData).length - 1) {
      gradient += ', ';
    }
    
    startPercentage = endPercentage;
  });
  
  gradient += ')';
  return gradient;
}

/**
 * Завантаження даних про останнє голосування
 */
async function fetchLastVoteData() {
  const resultsContainer = document.getElementById('lastVoteResults');
  
  if (!resultsContainer) return;
  
  resultsContainer.innerHTML = `<div class="loading-spinner"></div>`;
  
  try {
    const userId = await getUserId();
    if (!userId) {
      lastVoteData = {
        error: true,
        message: "⚠️ Помилка отримання даних користувача"
      };
      
      if (document.getElementById('lastVoteModal').style.display === "block") {
        renderLastVoteResults();
      }
      return;
    }

    // Отримуємо дані блокчейну
    const response = await fetch(`${BLOCKCHAIN_API_URL}/chain`);
    const blocks = await response.json();
    
    console.log("Отримано блоків:", blocks.length);
    
    // Знаходимо всі голосування користувача
    const userVotes = blocks.filter(block => {
      return block.type === 'vote' && block.voterId === userId;
    });
    
    console.log("Знайдено голосувань користувача:", userVotes.length);

    if (userVotes.length === 0) {
      lastVoteData = {
        noResults: true
      };
      
      if (document.getElementById('lastVoteModal').style.display === "block") {
        renderLastVoteResults();
      }
      return;
    }

    // Сортуємо за часом і беремо останнє
    userVotes.sort((a, b) => {
      const dateA = new Date(a.timestamp || a.creationDate);
      const dateB = new Date(b.timestamp || b.creationDate);
      return dateB - dateA; // Сортування за часом (спочатку найновіші)
    });

    // Отримуємо ID останнього голосування
    const lastVote = userVotes[0];
    const lastVoteId = lastVote.voteId;
    
    // Знаходимо блок створення цього голосування
    const voteCreationBlock = blocks.find(block => {
      return block.type === 'create_vote' && String(block.voteId) === String(lastVoteId);
    });
    
    if (!voteCreationBlock) {
      lastVoteData = {
        error: true,
        message: `Не знайдено інформацію про голосування #${lastVoteId}`
      };
      
      if (document.getElementById('lastVoteModal').style.display === "block") {
        renderLastVoteResults();
      }
      return;
    }
    
    // Назва голосування
    const voteTitle = voteCreationBlock.title;
    
    // Знаходимо всі голоси для цього голосування
    const allVotesForThisVoting = blocks.filter(block => {
      return block.type === 'vote' && String(block.voteId) === String(lastVoteId);
    });
    
    // Підрахунок голосів за кожним варіантом
    const optionCounts = {};
    
    allVotesForThisVoting.forEach(vote => {
      const option = vote.candidate;
      
      if (option) {
        optionCounts[option] = (optionCounts[option] || 0) + 1;
      }
    });
    
    // Обчислюємо загальну кількість голосів
    const totalVotes = Object.values(optionCounts).reduce((sum, count) => sum + count, 0);
    
    if (totalVotes === 0) {
      lastVoteData = {
        title: voteTitle,
        noVotes: true
      };
      
      if (document.getElementById('lastVoteModal').style.display === "block") {
        renderLastVoteResults();
      }
      return;
    }
    
    // Розширюємо дані для кожного варіанту
    const optionData = {};
    let maxVotes = 0;
    let winner = null;
    
    Object.entries(optionCounts).forEach(([option, count], index) => {
      const percentage = (count / totalVotes) * 100;
      
      optionData[option] = {
        count: count,
        percentage: percentage,
        color: getChartColor(index)
      };
      
      // Визначаємо переможця
      if (count > maxVotes) {
        maxVotes = count;
        winner = option;
      }
    });
    
    // Зберігаємо всі дані для відображення пізніше
    lastVoteData = {
      title: voteTitle,
      optionData: optionData,
      totalVotes: totalVotes,
      winner: winner
    };
    
    // Якщо модальне вікно відкрите, відображаємо результат
    if (document.getElementById('lastVoteModal').style.display === "block") {
      renderLastVoteResults();
    }
    
  } catch (err) {
    console.error("❌ Помилка при завантаженні результату останнього голосування:", err);
    
    lastVoteData = {
      error: true,
      message: "⚠️ Помилка завантаження даних"
    };
    
    if (document.getElementById('lastVoteModal').style.display === "block") {
      renderLastVoteResults();
    }
  }
}

/**
 * Відображення результатів останнього голосування
 */
function renderLastVoteResults() {
  const resultsContainer = document.getElementById('lastVoteResults');
  
  if (!resultsContainer) return;
  
  if (!lastVoteData) {
    resultsContainer.innerHTML = `<div class="loading-spinner"></div>`;
    return;
  }
  
  // Обробка помилок
  if (lastVoteData.error) {
    resultsContainer.innerHTML = `
      <div class="error-msg">${lastVoteData.message}</div>
    `;
    return;
  }
  
  // Обробка відсутності голосувань
  if (lastVoteData.noResults) {
    resultsContainer.innerHTML = `
      <div class="no-results">Ви ще не брали участі в голосуваннях</div>
    `;
    return;
  }
  
  // Обробка відсутності голосів
  if (lastVoteData.noVotes) {
    resultsContainer.innerHTML = `
      <div class="vote-title">${lastVoteData.title}</div>
      <div class="no-results">Немає голосів</div>
    `;
    return;
  }
  
  // Генеруємо conic-gradient для піе-діаграми
  const conicGradient = generateConicGradient(lastVoteData.optionData);
  
  // Будуємо результати у вигляді піе-діаграми
  let legendHTML = '';
  let resultCardsHTML = '';
  
  Object.entries(lastVoteData.optionData).forEach(([option, data]) => {
    const isWinner = option === lastVoteData.winner;
    
    // Додаємо до легенди
    legendHTML += `
      <div class="legend-item">
        <div class="legend-color" style="background-color: ${data.color};"></div>
        <span>${option}: ${data.percentage.toFixed(1)}%</span>
      </div>
    `;
    
    // Додаємо картку з результатом
    resultCardsHTML += `
      <div class="result-card">
        <h4 class="result-title">
          ${option} ${isWinner ? '<span class="winners-badge">Переможець</span>' : ''}
        </h4>
        <div class="votes-info">
          <span class="vote-count">${data.count} голосів</span>
          <span class="vote-percentage">${data.percentage.toFixed(1)}%</span>
        </div>
      </div>
    `;
  });
  
  // Відображаємо результати
  resultsContainer.innerHTML = `
    <div class="vote-title">${lastVoteData.title}</div>
    <div class="pie-chart" style="background: ${conicGradient}">
      <div class="pie-center">
        <span>Всього</span>
        <span>${lastVoteData.totalVotes}</span>
      </div>
    </div>
    <div class="legend">
      ${legendHTML}
    </div>
    ${resultCardsHTML}
  `;
}

// Встановлюємо обробники подій коли DOM завантажений
document.addEventListener('DOMContentLoaded', function() {
  // Оновлення інформації про останнє голосування кожні 30 секунд
  setInterval(fetchLastVoteData, 30000);
});

 // Перевірка статусу блокчейну
 async function checkBlockchainStatus() {
  try {
      const response = await fetch('https://blockchain-io-ffel.onrender.com/test', { timeout: 3000 });
      if (response.ok) {
          document.getElementById('status-indicator').className = 'fas fa-circle online';
          document.getElementById('status-text').textContent = 'Блокчейн онлайн';
      } else {
          document.getElementById('status-indicator').className = 'fas fa-circle offline';
          document.getElementById('status-text').textContent = 'Помилка підключення';
      }
  } catch (error) {
      document.getElementById('status-indicator').className = 'fas fa-circle offline';
      document.getElementById('status-text').textContent = 'Блокчейн офлайн';
  }
}

// Перевіряємо статус при завантаженні та кожні 30 секунд
document.addEventListener('DOMContentLoaded', function() {
  checkBlockchainStatus();
  setInterval(checkBlockchainStatus, 30000);
});
