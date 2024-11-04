use std::error;
use mongodb::error::Error as MongoError;
use serde_json::Error as SerdeError;


pub type AppResult<T> = std::result::Result<T, AppError>;

#[derive(Debug)]
pub enum AppError {
    DatabaseError(String),
    SerializationError(String),
}

impl std::fmt::Display for AppError {
    fn fmt(&self, f: &mut std::fmt::Formatter) -> std::fmt::Result {
        match self {
            AppError::DatabaseError(msg) => write!(f, "Database error: {}", msg),
            AppError::SerializationError(msg) => write!(f, "Serialization error: {}", msg),
        }
    }
}

impl error::Error for AppError { }

impl From<MongoError> for AppError {
    fn from(error: MongoError) -> Self {
        AppError::DatabaseError(error.to_string())
    }
}

impl From<SerdeError> for AppError {
    fn from(error: SerdeError) -> Self {
        AppError::SerializationError(error.to_string())
    }
}

impl From<base64::DecodeError> for AppError {
    fn from(error: base64::DecodeError) -> Self {
        AppError::SerializationError(error.to_string())
    }
}