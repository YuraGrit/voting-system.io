
// login.js
 

// Повідомлення
const ERROR_MESSAGES = {
  EMPTY_CODE: "❌ Будь ласка, введіть код!",
  INVALID_CODE: "❌ Невірний код!",
  SERVER_ERROR: "⚠️ Помилка з'єднання із сервером!"
};

// Локальне сховище
const STORAGE_KEY = 'session_token';

// URL API
const API_BASE_URL = 'https://registration-io.onrender.com';
const API_ENDPOINTS = {
  CHECK_AUTH: `${API_BASE_URL}/check-auth`,
  LOGIN: `${API_BASE_URL}/login`,
  REGISTER: `${API_BASE_URL}/register`,
  REGISTER_BULK: `${API_BASE_URL}/register-bulk`
};

// Перевірка авторизації при завантаженні сторінки
window.onload = function () {
  const token = localStorage.getItem(STORAGE_KEY);

  // Перевірка токену
  if (token) {
    checkTokenAndRedirect(token);
  }
};

// Обробник подій авторизації
document.addEventListener('DOMContentLoaded', function() {
  const authForm = document.getElementById('auth-form');
  if (authForm) {
    authForm.addEventListener('submit', function(e) {
      e.preventDefault();
      authorize();
    });
  }
  
  // Обробника поля вводу
  const authCodeInput = document.getElementById('authCode');
  if (authCodeInput) {
    authCodeInput.addEventListener('keypress', function(e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        authorize();
      }
    });
  }

  // Обробник модального вікна
  const createUsersLink = document.getElementById('createUsersLink');
  const modal = document.getElementById('createUsersModal');
  const closeModal = document.getElementById('closeModal');
  const createUsersBtn = document.getElementById('createUsersBtn');
  const copyAllCodesBtn = document.getElementById('copyAllCodes');

  if (createUsersLink) {
    createUsersLink.addEventListener('click', function() {
      modal.style.display = 'flex';
      document.getElementById('userCount').focus();
    });
  }

  if (closeModal) {
    closeModal.addEventListener('click', function() {
      modal.style.display = 'none';
      resetModal();
    });
  }

  // Закрити модального вікна при кліку за його межами
  window.addEventListener('click', function(event) {
    if (event.target === modal) {
      modal.style.display = 'none';
      resetModal();
    }
  });

  // Обробник створення користувачів
  if (createUsersBtn) {
    createUsersBtn.addEventListener('click', createUsers);
  }

  // Обробник копіювання всіх кодів
  if (copyAllCodesBtn) {
    copyAllCodesBtn.addEventListener('click', copyAllCodes);
  }
});

/**
 * Перевірка токену і перенаправлення на головну сторінку
 * @param {string} token
 */
async function checkTokenAndRedirect(token) {
  try {
    showLoader();
    
    const response = await fetch(API_ENDPOINTS.CHECK_AUTH, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${token}`
      }
    });

    if (response.ok) {
      // Перенаправлення на головну сторінку
      window.location.href = "index.html";
    } else {
      // Якщо токен невалідний, видаляємо його
      localStorage.removeItem(STORAGE_KEY);
      hideLoader();
    }
  } catch (error) {
    console.error("❌ Помилка перевірки авторизації:", error);
    localStorage.removeItem(STORAGE_KEY);
    hideLoader();
  }
}


// Функція авторизації

async function authorize() {
  const inputCode = document.getElementById("authCode").value.trim();
  const errorElement = document.getElementById("authError");

  // Перевірка наявності коду
  if (!inputCode) {
    showError(errorElement, ERROR_MESSAGES.EMPTY_CODE);
    return;
  }

  // Показ індикатора завантаження
  showLoader();

  try {
    const response = await fetch(API_ENDPOINTS.LOGIN, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ authCode: inputCode })
    });

    const data = await response.json();
    
    if (data.message === "Авторизація успішна!" && data.token) {
      // Збереження сесійного токену
      localStorage.setItem(STORAGE_KEY, data.token);
      
      // Зберігаємо groupId
      if (data.groupId) {
        localStorage.setItem('user_group_id', data.groupId);
      }
      
      // Зберігаємо статус користувача 
      if (data.status) {
        localStorage.setItem('user_status', data.status);
      }
      
      // Перенаправляємо на головну сторінку
      window.location.href = "index.html";
    } else {
      hideLoader();
      showError(errorElement, ERROR_MESSAGES.INVALID_CODE);
    }
  } catch (error) {
    console.error("Помилка авторизації:", error);
    hideLoader();
    showError(errorElement, ERROR_MESSAGES.SERVER_ERROR);
  }
}


//Функція створення групи користувачів

async function createUsers() {
  const userCount = parseInt(document.getElementById('userCount').value, 10);
  const createUsersBtn = document.getElementById('createUsersBtn');
  const usersListContainer = document.getElementById('usersListContainer');
  const usersList = document.getElementById('usersList');
  
  // Перевірка валідності введених даних
  if (isNaN(userCount) || userCount < 1 || userCount > 100) {
    alert('Будь ласка, введіть число від 1 до 100');
    return;
  }
  
  // Показуємо завантаження
  createUsersBtn.disabled = true;
  createUsersBtn.innerText = 'Створення...';
  
  try {
    // Запит на створення групи користувачів
    const response = await fetch(API_ENDPOINTS.REGISTER_BULK, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ userCount })
    });
    
    if (!response.ok) {
      throw new Error('Помилка сервера');
    }
    
    const data = await response.json();
    
    // Очищуємо список користувачів
    usersList.innerHTML = '';
    
    // Відображаємо адміністратора першим
    if (data.adminCode) {
      const adminItem = document.createElement('div');
      adminItem.className = 'user-code-item';
      adminItem.innerHTML = `
        <div>
          <strong>Адміністратор</strong>
          <div class="code">${data.adminCode}</div>
        </div>
        <button class="copy-btn" data-code="${data.adminCode}" title="Копіювати код">📋</button>
      `;
      usersList.appendChild(adminItem);
    }
    
    // Додаємо всіх користувачів
    data.users.forEach((user, index) => {
      const userItem = document.createElement('div');
      userItem.className = 'user-code-item';
      userItem.innerHTML = `
        <div>
          <strong>Користувач ${index + 1}</strong>
          <div class="code">${user.authCode}</div>
        </div>
        <button class="copy-btn" data-code="${user.authCode}" title="Копіювати код">📋</button>
      `;
      usersList.appendChild(userItem);
    });
    
    // Показуємо список користувачів
    usersListContainer.style.display = 'block';
    
    // Обробник кнопок копіювання
    document.querySelectorAll('.copy-btn').forEach(btn => {
      btn.addEventListener('click', function() {
        const code = this.getAttribute('data-code');
        navigator.clipboard.writeText(code).then(() => {
          const originalText = this.innerHTML;
          this.innerHTML = '✅';
          
          setTimeout(() => {
            this.innerHTML = originalText;
          }, 1500);
        });
      });
    });
    
    // Зміна тексту кнопки
    createUsersBtn.innerText = 'Користувачі створені!';
    
    // Повертаємо кнопку в початковий стан
    setTimeout(() => {
      createUsersBtn.innerText = 'Створити ще користувачів';
      createUsersBtn.disabled = false;
    }, 2000);
    
  } catch (error) {
    console.error('❌ Помилка створення користувачів:', error);
    alert('❌ Помилка створення користувачів. Будь ласка, спробуйте пізніше.');
    createUsersBtn.innerText = 'Створити користувачів';
    createUsersBtn.disabled = false;
  }
}

// Копіювання кодів в буфер обміну
function copyAllCodes() {
  const codeElements = document.querySelectorAll('.user-code-item .code');
  let allCodes = '';
  
  codeElements.forEach((codeEl, index) => {
    const roleText = index === 0 ? 'Адміністратор' : `Користувач ${index}`;
    allCodes += `${roleText}: ${codeEl.textContent}\n`;
  });
  
  navigator.clipboard.writeText(allCodes).then(() => {
    const copyAllBtn = document.getElementById('copyAllCodes');
    const originalText = copyAllBtn.innerText;
    
    copyAllBtn.innerText = '✅ Скопійовано!';
    
    setTimeout(() => {
      copyAllBtn.innerText = originalText;
    }, 1500);
  });
}


// Повернення вікна у початковий стан

function resetModal() {
  document.getElementById('usersListContainer').style.display = 'none';
  document.getElementById('usersList').innerHTML = '';
  document.getElementById('createUsersBtn').innerText = 'Створити користувачів';
  document.getElementById('createUsersBtn').disabled = false;
  document.getElementById('userCount').value = 3;
}

/**
 * Відображає повідомлення про помилку
 * @param {HTMLElement} element - HTML елемент для відображення помилки
 * @param {string} message - Повідомлення про помилку
 */
function showError(element, message) {
  if (element) {
    element.innerText = message;
    element.style.display = "block";
    
    document.getElementById("authCode").focus();
  }
}


// Показ індикатор завантаження
function showLoader() {
  const loader = document.getElementById("loader");
  if (loader) {
    loader.style.display = "block";
  }
  
  // Блокування кнопку під час завантаження
  const loginButton = document.querySelector('#auth button');
  if (loginButton) {
    loginButton.disabled = true;
  }
}

// Приховуємо індикатор завантаження
function hideLoader() {
  const loader = document.getElementById("loader");
  if (loader) {
    loader.style.display = "none";
  }
  
  // Розблоковання кнопки
  const loginButton = document.querySelector('#auth button');
  if (loginButton) {
    loginButton.disabled = false;
  }
}
