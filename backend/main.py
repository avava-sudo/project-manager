from fastapi import FastAPI, Depends, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from database import Base, engine, get_db
from models import Employee, Project, Task, User, UserSession
from schemes import (
    ProjectCreate,
    ProjectRead,
    ProjectUpdate,
    TaskCreate,
    TaskRead,
    TaskUpdate,
    EmployeeCreate,
    EmployeeRead,
    UserCreate,
    TokenRead,
)
from security import hash_password, new_token, verify_password

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Project Manager API",
    description="Проекты, задачи и команда: REST API для панели управления",
    version="1.2.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health_check():
    return {"status": "ok"}


def get_current_user(authorization: str = Header(default=""), db: Session = Depends(get_db)):
    token = authorization.removeprefix("Bearer ")
    session = db.get(UserSession, token)
    if session is None:
        raise HTTPException(status_code=401, detail="Нужно войти")
    return db.get(User, session.user_id)


def get_own_project(db: Session, project_id: int, user: User):
    project = db.get(Project, project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="Проект не найден")
    elif project.owner_id != user.id:
        raise HTTPException(status_code=403, detail="Нет доступа к этому проекту")
    return project


def get_own_task(db: Session, task_id: int, user: User):
    task = db.get(Task, task_id)
    if task is None:
        raise HTTPException(status_code=404, detail="Задача не найдена")
    get_own_project(db, task.project_id, user)
    return task


def get_own_employee(db: Session, employee_id: int, user: User):
    employee = db.get(Employee, employee_id)
    if employee is None or employee.owner_id != user.id:
        raise HTTPException(status_code=404, detail="Сотрудник не найден")
    return employee


def start_session(db: Session, user: User):
    token = new_token()
    db.add(UserSession(token=token, user_id=user.id))
    db.commit()
    return {"token": token, "username": user.username}


@app.post("/register", response_model=TokenRead)
def register(data: UserCreate, db: Session = Depends(get_db)):
    if db.query(User).filter(User.username == data.username).first() is not None:
        raise HTTPException(status_code=400, detail="Такой логин уже занят")
    password_hash, salt = hash_password(data.password)

    user = User(username=data.username, password_hash=password_hash, salt=salt)
    db.add(user)
    db.commit()
    db.refresh(user)
    return start_session(db, user)


@app.post("/login", response_model=TokenRead)
def login(data: UserCreate, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == data.username).first()
    if user is None or not verify_password(data.password, user.salt, user.password_hash):
        raise HTTPException(status_code=401, detail="Неверный логин или пароль")
    return start_session(db, user)


@app.post("/logout")
def logout(authorization: str = Header(default=""), db: Session = Depends(get_db)):
    session = db.get(UserSession, authorization.removeprefix("Bearer "))
    if session is not None:
        db.delete(session)
        db.commit()
    return {"status": "ok"}


@app.get("/me")
def me(user: User = Depends(get_current_user)):
    return {"id": user.id, "username": user.username}


@app.get("/projects", response_model=list[ProjectRead])
def get_projects(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.query(Project).filter(Project.owner_id == user.id).all()


@app.post("/projects", response_model=ProjectRead)
def create_project(data: ProjectCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    project = Project(
        name=data.name,
        description=data.description,
        status=data.status,
        owner_id=user.id,
    )
    db.add(project)
    db.commit()
    db.refresh(project)
    return project


@app.patch("/projects/{project_id}", response_model=ProjectRead)
def update_project(project_id: int, data: ProjectUpdate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    project = get_own_project(db, project_id, user)

    project.status = data.status
    db.commit()
    db.refresh(project)
    return project


@app.delete("/projects/{project_id}")
def delete_project(project_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    project = get_own_project(db, project_id, user)

    db.delete(project)
    db.commit()
    return {"status": "deleted"}


@app.get("/tasks", response_model=list[TaskRead])
def get_tasks(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.query(Task).join(Project).filter(Project.owner_id == user.id).all()


@app.post("/tasks", response_model=TaskRead)
def create_task(data: TaskCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    get_own_project(db, data.project_id, user)
    if data.assignee_id is not None:
        get_own_employee(db, data.assignee_id, user)

    task = Task(
        title=data.title,
        priority=data.priority,
        status=data.status,
        project_id=data.project_id,
        assignee_id=data.assignee_id,
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


@app.patch("/tasks/{task_id}", response_model=TaskRead)
def update_task(task_id: int, data: TaskUpdate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    task = get_own_task(db, task_id, user)

    task.status = data.status
    db.commit()
    db.refresh(task)
    return task


@app.delete("/tasks/{task_id}")
def delete_task(task_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    task = get_own_task(db, task_id, user)

    db.delete(task)
    db.commit()
    return {"status": "deleted"}


@app.get("/employees", response_model=list[EmployeeRead])
def get_employees(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.query(Employee).filter(Employee.owner_id == user.id).all()


@app.post("/employees", response_model=EmployeeRead)
def create_employee(data: EmployeeCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    same_email = db.query(Employee).filter(Employee.owner_id == user.id, Employee.email == data.email).first()
    if same_email is not None:
        raise HTTPException(status_code=400, detail="Сотрудник с таким email уже есть")

    employee = Employee(
        name=data.name,
        email=data.email,
        position=data.position,
        owner_id=user.id,
    )
    db.add(employee)
    db.commit()
    db.refresh(employee)
    return employee


@app.delete("/employees/{employee_id}")
def delete_employee(employee_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    employee = get_own_employee(db, employee_id, user)

    # задачи остаются, просто без исполнителя
    db.query(Task).filter(Task.assignee_id == employee_id).update({"assignee_id": None})

    db.delete(employee)
    db.commit()
    return {"status": "deleted"}
