from typing import Literal
from pydantic import BaseModel, ConfigDict, Field



ProjectStatus = Literal["planned", "active", "completed"]
TaskStatus = Literal["todo", "in_progress", "done"]
TaskPriority = Literal["low", "medium", "high"]

class ProjectCreate(BaseModel):
    name: str = Field(
        min_length=2,
        max_length=100,
        description="The name of the project",
    )

    description: str = Field(
        "",
        max_length=2000,
        description="A brief description of the project",
    )

    status: ProjectStatus = Field(
        default="planned",
        description="The current status of the project",
    )

class ProjectUpdate(BaseModel):
    status: ProjectStatus = Field(
        ...,
        description="The new status of the project",
    )

class ProjectRead(BaseModel):
    id: int = Field(
        ...,
        description="The unique identifier of the project",
    )

    name: str = Field(
        ...,
        min_length=2,
        max_length=100,
        description="The name of the project",
    )

    description: str = Field(
        "",
        max_length=2000,
        description="A brief description of the project",
    )

    status: ProjectStatus = Field(
        default="planned",
        description="The current status of the project",
    )
    model_config = ConfigDict(from_attributes=True)


class TaskCreate(BaseModel):
    title: str = Field(
        min_length=2,
        max_length=200,
        description="The title of the task",
    )

    priority: TaskPriority = Field(
        default="medium",
        description="The priority of the task",
    )

    status: TaskStatus = Field(
        default="todo",
        description="The current status of the task",
    )

    project_id: int = Field(
        ...,
        description="The project this task belongs to",
    )

    assignee_id: int | None = Field(
        default=None,
        description="The employee assigned to this task",
    )

class TaskUpdate(BaseModel):
    status: TaskStatus = Field(
        ...,
        description="The new status of the task",
    )

class TaskRead(BaseModel):
    id: int = Field(
        ...,
        description="The unique identifier of the task",
    )

    title: str = Field(
        ...,
        description="The title of the task",
    )

    priority: TaskPriority = Field(
        default="medium",
        description="The priority of the task",
    )

    status: TaskStatus = Field(
        default="todo",
        description="The current status of the task",
    )

    project_id: int = Field(
        ...,
        description="The project this task belongs to",
    )

    assignee_id: int | None = Field(
        default=None,
        description="The employee assigned to this task",
    )
    model_config = ConfigDict(from_attributes=True)

class EmployeeCreate(BaseModel):
    name: str = Field(
        ...,
        min_length=2,
        max_length=100,
        description="The name of the employee",
    )

    email: str = Field(
        ...,
        max_length=100,
        description="The email of the employee",
    )

    position: str = Field(
        ...,
        min_length=2,
        max_length=50,
        description="The position of the employee",
    )

class EmployeeRead(BaseModel):
    id: int = Field(
        ...,
        description="The unique identifier of the employee",
    )

    name: str = Field(
        ...,
        min_length=2,
        max_length=100,
        description="The name of the employee",
    )

    email: str = Field(
        ...,
        max_length=100,
        description="The email of the employee",
    )

    position: str = Field(
        ...,
        description="The position of the employee",
    )
    model_config = ConfigDict(from_attributes=True)

class UserCreate(BaseModel):
    username: str = Field(min_length=3, max_length=50)
    password: str = Field(min_length=6, max_length=128)

class TokenRead(BaseModel):
    token: str
    username: str