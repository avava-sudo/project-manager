from sqlalchemy import create_engine  
from sqlalchemy.orm import DeclarativeBase, sessionmaker  

BASE_URL = "sqlite:///./database.db"
engine = create_engine(
    BASE_URL,
    connect_args={"check_same_thread": False},
)
create_session = sessionmaker(bind=engine, autoflush=False, autocommit=False)

class Base(DeclarativeBase):
    pass


def get_db():
    db = create_session()
    try:
        yield db
    finally:
        db.close()