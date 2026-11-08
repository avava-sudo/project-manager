from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from database import Base, engine, get_db
from models import Employee, Project, Task
from schemes import (
    ProjectCreate,
    ProjectRead,
    TaskCreate,
    TaskRead,
    TaskUpdate,
    EmployeeCreate,
    EmployeeRead,
)

# создаём таблицы в базе, если их ещё нет
Base.metadata.create_all(bind=engine)

app = FastAPI()

# разрешаем сайту (index.html) обращаться к API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health_check():
    return {"status": "ok"}


# ===== ПРОЕКТЫ =====

@app.get("/projects", response_model=list[ProjectRead])
def get_projects(db: Session = Depends(get_db)):
    return db.query(Project).all()


@app.post("/projects", response_model=ProjectRead)
def create_project(data: ProjectCreate, db: Session = Depends(get_db)):
    project = Project(
        name=data.name,
        description=data.description,
        status=data.status,
    )
    db.add(project)
    db.commit()
    db.refresh(project)
    return project


@app.delete("/projects/{project_id}")
def delete_project(project_id: int, db: Session = Depends(get_db)):
    project = db.get(Project, project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="Проект не найден")

    db.delete(project)
    db.commit()
    return {"status": "deleted"}


# ===== ЗАДАЧИ =====

@app.get("/tasks", response_model=list[TaskRead])
def get_tasks(db: Session = Depends(get_db)):
    return db.query(Task).all()


@app.post("/tasks", response_model=TaskRead)
def create_task(data: TaskCreate, db: Session = Depends(get_db)):
    if db.get(Project, data.project_id) is None:
        raise HTTPException(status_code=404, detail="Проект не найден")

    if data.assignee_id is not None and db.get(Employee, data.assignee_id) is None:
        raise HTTPException(status_code=404, detail="Сотрудник не найден")

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
def update_task(task_id: int, data: TaskUpdate, db: Session = Depends(get_db)):
    task = db.get(Task, task_id)
    if task is None:
        raise HTTPException(status_code=404, detail="Задача не найдена")

    task.status = data.status
    db.commit()
    db.refresh(task)
    return task


@app.delete("/tasks/{task_id}")
def delete_task(task_id: int, db: Session = Depends(get_db)):
    task = db.get(Task, task_id)
    if task is None:
        raise HTTPException(status_code=404, detail="Задача не найдена")

    db.delete(task)
    db.commit()
    return {"status": "deleted"}

# ===== СОТРУДНИКИ =====

@app.get("/employees", response_model=list[EmployeeRead])
def get_employees(db: Session = Depends(get_db)):
    return db.query(Employee).all()

@app.post("/employees", response_model=EmployeeRead)
def create_employee(data: EmployeeCreate, db: Session = Depends(get_db)):
    if db.query(Employee).filter(Employee.email == data.email).first() is not None:
        raise HTTPException(status_code=400, detail="Сотрудник с таким email уже есть")

    employee = Employee(
        name=data.name,
        email=data.email,
        position=data.position,
    )
    db.add(employee)
    db.commit()
    db.refresh(employee)
    return employee

@app.delete("/employees/{employee_id}")
def delete_employee(employee_id: int, db: Session = Depends(get_db)):
    employee = db.get(Employee, employee_id)
    if employee is None:
        raise HTTPException(status_code=404, detail="Сотрудник не найден")

    # задачи этого сотрудника становятся «не назначены»
    db.query(Task).filter(Task.assignee_id == employee_id).update({"assignee_id": None})

    db.delete(employee)
    db.commit()
    return {"status": "deleted"}

    

