
document.addEventListener("DOMContentLoaded", () => {
    // адрес бэкенда (запуск: cd backend → uvicorn main:app --reload)
    const API_URL = "http://127.0.0.1:8000";

    // русские названия статусов и приоритетов
    const taskStatusNames = { todo: "Ожидает", in_progress: "В работе", done: "Готово" };
    const projectStatusNames = { planned: "Запланирован", active: "Активный", completed: "Завершён" };
    const priorityNames = { low: "Низкий приоритет", medium: "Средний приоритет", high: "Высокий приоритет" };

    // данные с сервера
    let projects = [];
    let tasks = [];

    // ===== СТРАНИЦЫ =====

    const pages = {
        dashboard: {
            element: document.querySelector("#dashboard-page"),
            title: "Главная"
        },
        projects: {
            element: document.querySelector("#projects-page"),
            title: "Проекты"
        },
        tasks: {
            element: document.querySelector("#tasks-page"),
            title: "Задачи"
        }
    };

    const menuLinks = document.querySelectorAll(".menu a");
    const pageTitle = document.querySelector(".topbar h1");

    function showPage(pageName) {
        const selectedPage = pages[pageName];

        if (!selectedPage || !selectedPage.element) return;

        Object.values(pages).forEach(page => {
            if (page.element) {
                page.element.hidden = true;
            }
        });

        selectedPage.element.hidden = false;
        pageTitle.textContent = selectedPage.title;

        menuLinks.forEach(link => {
            const isActive = link.getAttribute("href") === `#${pageName}`;
            link.classList.toggle("active", isActive);
        });
    }

    menuLinks.forEach(link => {
        link.addEventListener("click", event => {
            const pageName = link.getAttribute("href").slice(1);

            if (!pages[pageName]) return;

            event.preventDefault();
            showPage(pageName);
        });
    });

    document.querySelector("#all-tasks-btn").addEventListener("click", () => showPage("tasks"));
    document.querySelector("#all-projects-btn").addEventListener("click", () => showPage("projects"));

    // ===== ЗАГРУЗКА ДАННЫХ =====

    const errorBox = document.querySelector("#error");

    async function loadData() {
        try {
            const projectsResponse = await fetch(`${API_URL}/projects`);
            const tasksResponse = await fetch(`${API_URL}/tasks`);

            // сервер ответил, но с ошибкой (например 500)
            if (!projectsResponse.ok || !tasksResponse.ok) {
                errorBox.textContent = "Ошибка на сервере — смотри терминал с uvicorn";
                errorBox.hidden = false;
                return;
            }

            projects = await projectsResponse.json();
            tasks = await tasksResponse.json();

            errorBox.hidden = true;
            render();
        } catch {
            errorBox.textContent = "Сервер не отвечает. Запусти бэкенд: cd backend → uvicorn main:app --reload";
            errorBox.hidden = false;
        }
    }

    // перерисовывает всё на странице
    function render() {
        // статистика
        const doneCount = tasks.filter(task => task.status === "done").length;
        document.querySelector("#stat-projects").textContent = projects.length;
        document.querySelector("#stat-tasks").textContent = tasks.length;
        document.querySelector("#stat-open").textContent = tasks.length - doneCount;
        document.querySelector("#stat-done").textContent = doneCount;

        // главная: 5 последних задач и проекты
        const lastTasks = document.querySelector("#last-tasks");
        lastTasks.innerHTML = "";
        tasks.slice(-5).reverse().forEach(task => {
            lastTasks.append(createTask(task, false));
        });

        const lastProjects = document.querySelector("#last-projects");
        lastProjects.innerHTML = "";
        projects.forEach(project => {
            lastProjects.append(createProject(project));
        });

        // страница «Проекты»
        const projectGrid = document.querySelector("#project-grid");
        projectGrid.innerHTML = "";
        projects.forEach(project => {
            projectGrid.append(createProjectCard(project));
        });

        // страница «Задачи» (с фильтром по статусу)
        const status = document.querySelector("#status-filter").value;
        const allTasks = document.querySelector("#all-tasks");
        allTasks.innerHTML = "";
        tasks
            .filter(task => !status || task.status === status)
            .forEach(task => {
                allTasks.append(createTask(task, true));
            });

        // если пусто — показываем подсказку
        if (!tasks.length) lastTasks.append(createEmpty("Задач пока нет"));
        if (!projects.length) lastProjects.append(createEmpty("Проектов пока нет"));
        if (!projects.length) projectGrid.append(createEmpty("Проектов пока нет — создай первый"));
        if (!allTasks.children.length) allTasks.append(createEmpty("Задач не найдено"));

        // список проектов в окне «Новая задача»
        const taskProject = document.querySelector("#task-project");
        taskProject.innerHTML = "";
        projects.forEach(project => {
            taskProject.append(new Option(project.name, project.id));
        });
    }

    // ===== ЭЛЕМЕНТЫ =====
    // текст ставим через textContent, а не innerHTML — так безопасно

    function getProjectName(projectId) {
        const project = projects.find(p => p.id === projectId);
        return project ? project.name : "";
    }

    function countTasks(projectId) {
        return tasks.filter(task => task.project_id === projectId).length;
    }

    function createEmpty(text) {
        const p = document.createElement("p");
        p.className = "empty";
        p.textContent = text;
        return p;
    }

    // задача: <div class="task"> <div> h3 + p </div> span </div>
    function createTask(task, withControls) {
        const div = document.createElement("div");
        div.className = "task";

        const info = document.createElement("div");
        const h3 = document.createElement("h3");
        const p = document.createElement("p");
        h3.textContent = task.title;
        p.textContent = `${getProjectName(task.project_id)} · ${priorityNames[task.priority]}`;
        info.append(h3, p);
        div.append(info);

        if (!withControls) {
            const span = document.createElement("span");
            span.className = `status-${task.status}`;
            span.textContent = taskStatusNames[task.status];
            div.append(span);
            return div;
        }

        // на странице «Задачи»: смена статуса и удаление
        const controls = document.createElement("div");
        controls.className = "task-controls";

        const select = document.createElement("select");
        select.className = `status-${task.status}`;
        Object.entries(taskStatusNames).forEach(([value, name]) => {
            select.append(new Option(name, value, false, value === task.status));
        });
        select.addEventListener("change", () => changeTaskStatus(task.id, select.value));

        const deleteBtn = document.createElement("button");
        deleteBtn.className = "delete-btn";
        deleteBtn.textContent = "✕";
        deleteBtn.addEventListener("click", () => deleteTask(task));

        controls.append(select, deleteBtn);
        div.append(controls);
        return div;
    }

    // проект на главной: <div class="project"> h3 + p </div>
    function createProject(project) {
        const div = document.createElement("div");
        div.className = "project";

        const h3 = document.createElement("h3");
        const p = document.createElement("p");
        h3.textContent = project.name;
        p.textContent = `Задач: ${countTasks(project.id)}`;

        div.append(h3, p);
        return div;
    }

    // карточка на странице «Проекты»
    function createProjectCard(project) {
        const div = document.createElement("div");
        div.className = "project-card";

        const h3 = document.createElement("h3");
        const p = document.createElement("p");
        const span = document.createElement("span");
        const status = document.createElement("small");
        const deleteBtn = document.createElement("button");

        h3.textContent = project.name;
        p.textContent = project.description || "Без описания";
        span.textContent = `Задач: ${countTasks(project.id)}`;
        status.className = `status-${project.status}`;
        status.textContent = projectStatusNames[project.status];
        deleteBtn.className = "delete-btn";
        deleteBtn.textContent = "✕";
        deleteBtn.addEventListener("click", () => deleteProject(project));

        div.append(deleteBtn, status, h3, p, span);
        return div;
    }

    // ===== ДЕЙСТВИЯ =====

    async function changeTaskStatus(taskId, status) {
        await fetch(`${API_URL}/tasks/${taskId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: status })
        });
        loadData();
    }

    async function deleteTask(task) {
        if (!confirm(`Удалить задачу «${task.title}»?`)) return;

        await fetch(`${API_URL}/tasks/${task.id}`, { method: "DELETE" });
        loadData();
    }

    async function deleteProject(project) {
        if (!confirm(`Удалить проект «${project.name}» вместе с задачами?`)) return;

        await fetch(`${API_URL}/projects/${project.id}`, { method: "DELETE" });
        loadData();
    }

    document.querySelector("#status-filter").addEventListener("change", render);

    // ===== ОКНА СОЗДАНИЯ =====

    const projectDialog = document.querySelector("#project-dialog");
    const taskDialog = document.querySelector("#task-dialog");

    document.querySelector("#new-project-btn").addEventListener("click", () => {
        projectDialog.showModal();
    });

    document.querySelector("#new-task-btn").addEventListener("click", () => {
        if (!projects.length) {
            alert("Сначала создай проект");
            return;
        }
        taskDialog.showModal();
    });

    // кнопки «Отмена» закрывают своё окно
    document.querySelectorAll(".cancel-btn").forEach(button => {
        button.addEventListener("click", () => button.closest("dialog").close());
    });

    document.querySelector("#project-form").addEventListener("submit", async event => {
        event.preventDefault();
        const form = event.target;

        const response = await fetch(`${API_URL}/projects`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                name: form.elements["name"].value,
                description: form.elements["description"].value,
                status: form.elements["status"].value
            })
        });

        if (!response.ok) {
            alert("Не удалось создать проект");
            return;
        }

        form.reset();
        projectDialog.close();
        loadData();
    });

    document.querySelector("#task-form").addEventListener("submit", async event => {
        event.preventDefault();
        const form = event.target;

        const response = await fetch(`${API_URL}/tasks`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                title: form.elements["title"].value,
                priority: form.elements["priority"].value,
                project_id: Number(form.elements["project_id"].value)
            })
        });

        if (!response.ok) {
            alert("Не удалось создать задачу");
            return;
        }

        form.reset();
        taskDialog.close();
        loadData();
    });

    // ===== СТАРТ =====

    showPage("dashboard");
    loadData();
});
