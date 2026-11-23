document.addEventListener("DOMContentLoaded", () => {
    const isLocal = ["", "localhost", "127.0.0.1"].includes(location.hostname);
    const API_URL = isLocal ? "http://127.0.0.1:8000" : "https://RENDER_ADDRESS.onrender.com";

    const taskStatusNames = { todo: "Ожидает", in_progress: "В работе", done: "Готово" };
    const projectStatusNames = { planned: "Запланирован", active: "Активный", completed: "Завершён" };
    const priorityNames = { low: "Низкий", medium: "Средний", high: "Высокий" };

    let token = localStorage.getItem("token");
    let username = localStorage.getItem("username");

    let projects = [];
    let tasks = [];
    let employees = [];

    const $ = selector => document.querySelector(selector);

    function el(tag, className, text) {
        const element = document.createElement(tag);
        if (className) element.className = className;
        if (text !== undefined) element.textContent = text;
        return element;
    }

    // --- вход и регистрация ---

    const authScreen = $("#auth");
    const appScreen = $("#app");
    const authForm = $("#auth-form");
    const authError = $("#auth-error");
    let registerMode = false;

    function showAuth() {
        appScreen.hidden = true;
        authScreen.hidden = false;
        authForm.elements["username"].focus();
    }

    function showApp() {
        authScreen.hidden = true;
        appScreen.hidden = false;
        $("#account-name").textContent = username;
        $("#account-avatar").textContent = username.charAt(0).toUpperCase();
        loadData();
    }

    function setRegisterMode(on) {
        registerMode = on;
        authError.hidden = true;
        $("#auth-title").textContent = on ? "Регистрация" : "Вход";
        $("#auth-submit").textContent = on ? "Создать аккаунт" : "Войти";
        $("#auth-question").textContent = on ? "Уже есть аккаунт?" : "Нет аккаунта?";
        $("#auth-toggle").textContent = on ? "Войти" : "Зарегистрироваться";
        authForm.elements["password"].autocomplete = on ? "new-password" : "current-password";
    }

    $("#auth-toggle").addEventListener("click", () => setRegisterMode(!registerMode));

    authForm.addEventListener("submit", async event => {
        event.preventDefault();
        authError.hidden = true;

        const path = registerMode ? "/register" : "/login";
        const body = {
            username: authForm.elements["username"].value.trim(),
            password: authForm.elements["password"].value
        };

        const submit = $("#auth-submit");
        const submitText = submit.textContent;
        submit.disabled = true;
        submit.textContent = "Подключаюсь…";

        try {
            const response = await fetch(API_URL + path, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body)
            });
            const data = await response.json().catch(() => ({}));

            if (!response.ok) {
                authError.textContent = typeof data.detail === "string" ? data.detail : "Проверь логин и пароль";
                authError.hidden = false;
                return;
            }

            token = data.token;
            username = data.username;
            localStorage.setItem("token", token);
            localStorage.setItem("username", username);
            authForm.reset();
            showApp();
        } catch {
            authError.textContent = isLocal
                ? "Сервер не отвечает. Запусти бэкенд: cd backend → uvicorn main:app --reload"
                : "Сервер не отвечает, попробуй ещё раз через минуту";
            authError.hidden = false;
        } finally {
            submit.disabled = false;
            submit.textContent = submitText;
        }
    });

    function forgetUser() {
        token = null;
        username = null;
        localStorage.removeItem("token");
        localStorage.removeItem("username");
        projects = [];
        tasks = [];
        employees = [];
    }

    $("#logout-btn").addEventListener("click", async () => {
        await fetch(API_URL + "/logout", {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` }
        }).catch(() => {});
        forgetUser();
        setRegisterMode(false);
        showAuth();
    });

    // --- запросы к API ---

    const errorBox = $("#error");

    function showError(text) {
        errorBox.textContent = text;
        errorBox.hidden = false;
    }

    async function api(method, path, body) {
        const options = { method, headers: { Authorization: `Bearer ${token}` } };
        if (body) {
            options.headers["Content-Type"] = "application/json";
            options.body = JSON.stringify(body);
        }

        let response;
        try {
            response = await fetch(API_URL + path, options);
        } catch {
            showError("Сервер не отвечает. Запусти бэкенд: cd backend → uvicorn main:app --reload");
            return null;
        }

        if (response.status === 401) {
            forgetUser();
            showAuth();
            return null;
        }

        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            alert(typeof data.detail === "string" ? data.detail : "Сервер вернул ошибку");
            return null;
        }
        return data;
    }

    async function loadData() {
        const [projectsData, tasksData, employeesData] = await Promise.all([
            api("GET", "/projects"),
            api("GET", "/tasks"),
            api("GET", "/employees")
        ]);
        if (!projectsData || !tasksData || !employeesData) return;

        projects = projectsData;
        tasks = tasksData;
        employees = employeesData;
        errorBox.hidden = true;
        render();
    }

    // --- страницы ---

    const pages = {
        dashboard: { element: $("#dashboard-page"), title: "Главная" },
        projects: { element: $("#projects-page"), title: "Проекты" },
        tasks: { element: $("#tasks-page"), title: "Задачи" },
        team: { element: $("#team-page"), title: "Команда" }
    };

    const menuLinks = document.querySelectorAll(".menu a");

    function showPage(pageName) {
        const selectedPage = pages[pageName];
        if (!selectedPage) return;

        Object.values(pages).forEach(page => page.element.hidden = true);
        selectedPage.element.hidden = false;
        $("#page-title").textContent = selectedPage.title;

        menuLinks.forEach(link => {
            link.classList.toggle("active", link.getAttribute("href") === `#${pageName}`);
        });

        history.replaceState(null, "", `#${pageName}`);
    }

    menuLinks.forEach(link => {
        link.addEventListener("click", event => {
            event.preventDefault();
            showPage(link.getAttribute("href").slice(1));
        });
    });

    document.querySelectorAll("[data-goto]").forEach(button => {
        button.addEventListener("click", () => showPage(button.dataset.goto));
    });

    $("#today").textContent = new Date().toLocaleDateString("ru-RU", {
        weekday: "long",
        day: "numeric",
        month: "long"
    });

    // --- отрисовка ---

    function fillList(container, items, createItem, emptyText) {
        container.replaceChildren(...items.map(createItem));
        if (!items.length) container.append(el("p", "empty", emptyText));
    }

    function render() {
        const doneCount = tasks.filter(task => task.status === "done").length;
        $("#stat-projects").textContent = projects.length;
        $("#stat-tasks").textContent = tasks.length;
        $("#stat-open").textContent = tasks.length - doneCount;
        $("#stat-done").textContent = doneCount;

        const lastTasks = tasks.slice(-5).reverse();
        fillList($("#last-tasks"), lastTasks, task => createTask(task, false), "Задач пока нет");
        fillList($("#last-projects"), projects.slice(0, 5), createProject, "Проектов пока нет");
        fillList($("#project-grid"), projects, createProjectCard, "Проектов пока нет — создай первый");

        const status = $("#status-filter").value;
        const filtered = tasks.filter(task => !status || task.status === status);
        fillList($("#all-tasks"), filtered, task => createTask(task, true), "Задач не найдено");

        fillList($("#team-grid"), employees, createEmployeeCard, "В команде пока никого — добавь первого сотрудника");

        const taskProject = $("#task-project");
        taskProject.replaceChildren(...projects.map(project => new Option(project.name, project.id)));

        const taskAssignee = $("#task-assignee");
        taskAssignee.replaceChildren(
            new Option("Без исполнителя", ""),
            ...employees.map(employee => new Option(employee.name, employee.id))
        );
    }

    function getProjectName(projectId) {
        const project = projects.find(p => p.id === projectId);
        return project ? project.name : "";
    }

    function getEmployeeName(employeeId) {
        const employee = employees.find(e => e.id === employeeId);
        return employee ? employee.name : "";
    }

    function projectProgress(projectId) {
        const projectTasks = tasks.filter(task => task.project_id === projectId);
        const done = projectTasks.filter(task => task.status === "done").length;
        return { done, total: projectTasks.length };
    }

    function createProgress(projectId) {
        const { done, total } = projectProgress(projectId);
        const progress = el("div", "progress");
        const bar = el("div", "progress-bar");
        bar.style.width = `${total ? Math.round(done / total * 100) : 0}%`;
        progress.title = `Выполнено ${done} из ${total}`;
        progress.append(bar);
        return progress;
    }

    function createStatusSelect(names, current, onChange) {
        const select = el("select", `chip status-${current}`);
        Object.entries(names).forEach(([value, name]) => {
            select.append(new Option(name, value, false, value === current));
        });
        select.addEventListener("change", () => onChange(select.value));
        return select;
    }

    function createDeleteButton(onClick) {
        const button = el("button", "delete-btn", "✕");
        button.title = "Удалить";
        button.addEventListener("click", onClick);
        return button;
    }

    function createTask(task, withControls) {
        const row = el("div", `task priority-${task.priority}`);
        const info = el("div", "task-info");

        const meta = [getProjectName(task.project_id), `${priorityNames[task.priority]} приоритет`];
        const assignee = getEmployeeName(task.assignee_id);
        if (assignee) meta.push(assignee);

        info.append(el("h3", "", task.title), el("p", "", meta.join(" · ")));
        row.append(info);

        if (!withControls) {
            row.append(el("span", `chip status-${task.status}`, taskStatusNames[task.status]));
            return row;
        }

        const controls = el("div", "task-controls");
        controls.append(
            createStatusSelect(taskStatusNames, task.status, status => changeTaskStatus(task.id, status)),
            createDeleteButton(() => deleteTask(task))
        );
        row.append(controls);
        return row;
    }

    function createProject(project) {
        const { done, total } = projectProgress(project.id);
        const row = el("div", "project");
        row.append(
            el("h3", "", project.name),
            el("p", "", `${done} из ${total} задач`),
            createProgress(project.id)
        );
        return row;
    }

    function createProjectCard(project) {
        const { done, total } = projectProgress(project.id);
        const card = el("div", "card");

        const top = el("div", "card-top");
        top.append(
            createStatusSelect(projectStatusNames, project.status, status => changeProjectStatus(project.id, status)),
            createDeleteButton(() => deleteProject(project))
        );

        card.append(
            top,
            el("h3", "", project.name),
            el("p", "", project.description || "Без описания"),
            el("small", "", `Выполнено ${done} из ${total}`),
            createProgress(project.id)
        );
        return card;
    }

    function createEmployeeCard(employee) {
        const card = el("div", "card employee");

        const employeeTasks = tasks.filter(task => task.assignee_id === employee.id);
        const openTasks = employeeTasks.filter(task => task.status !== "done").length;

        const top = el("div", "card-top");
        top.append(
            el("div", "avatar", employee.name.charAt(0).toUpperCase()),
            createDeleteButton(() => deleteEmployee(employee))
        );

        card.append(
            top,
            el("h3", "", employee.name),
            el("p", "", employee.position),
            el("p", "email", employee.email),
            el("small", "", `Задач: ${employeeTasks.length}, открытых: ${openTasks}`)
        );
        return card;
    }

    // --- действия ---

    async function changeTaskStatus(taskId, status) {
        await api("PATCH", `/tasks/${taskId}`, { status });
        loadData();
    }

    async function changeProjectStatus(projectId, status) {
        await api("PATCH", `/projects/${projectId}`, { status });
        loadData();
    }

    async function deleteTask(task) {
        if (!confirm(`Удалить задачу «${task.title}»?`)) return;
        await api("DELETE", `/tasks/${task.id}`);
        loadData();
    }

    async function deleteProject(project) {
        if (!confirm(`Удалить проект «${project.name}» вместе с задачами?`)) return;
        await api("DELETE", `/projects/${project.id}`);
        loadData();
    }

    async function deleteEmployee(employee) {
        if (!confirm(`Удалить сотрудника «${employee.name}»? Его задачи останутся без исполнителя.`)) return;
        await api("DELETE", `/employees/${employee.id}`);
        loadData();
    }

    $("#status-filter").addEventListener("change", render);

    // --- окна создания ---

    const projectDialog = $("#project-dialog");
    const taskDialog = $("#task-dialog");
    const employeeDialog = $("#employee-dialog");

    $("#new-project-btn").addEventListener("click", () => projectDialog.showModal());
    $("#new-employee-btn").addEventListener("click", () => employeeDialog.showModal());

    $("#new-task-btn").addEventListener("click", () => {
        if (!projects.length) {
            alert("Сначала создай проект");
            return;
        }
        taskDialog.showModal();
    });

    document.querySelectorAll(".cancel-btn").forEach(button => {
        button.addEventListener("click", () => button.closest("dialog").close());
    });

    function onSubmit(form, dialog, path, getBody) {
        form.addEventListener("submit", async event => {
            event.preventDefault();
            const result = await api("POST", path, getBody(form.elements));
            if (!result) return;

            form.reset();
            dialog.close();
            loadData();
        });
    }

    onSubmit($("#project-form"), projectDialog, "/projects", fields => ({
        name: fields["name"].value.trim(),
        description: fields["description"].value.trim(),
        status: fields["status"].value
    }));

    onSubmit($("#task-form"), taskDialog, "/tasks", fields => ({
        title: fields["title"].value.trim(),
        priority: fields["priority"].value,
        project_id: Number(fields["project_id"].value),
        assignee_id: fields["assignee_id"].value ? Number(fields["assignee_id"].value) : null
    }));

    onSubmit($("#employee-form"), employeeDialog, "/employees", fields => ({
        name: fields["name"].value.trim(),
        email: fields["email"].value.trim(),
        position: fields["position"].value.trim()
    }));

    // --- старт ---

    const startPage = location.hash.slice(1);
    showPage(pages[startPage] ? startPage : "dashboard");

    if (token && username) {
        showApp();
    } else {
        showAuth();
    }
});
