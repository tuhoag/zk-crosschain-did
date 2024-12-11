use std::error;
use actix_web::ResponseError;
use mongodb::error::Error as MongoError;
use serde_json::Error as SerdeError;
use url::ParseError;


pub type ApiResult<T> = std::result::Result<T, ApiError>;

#[derive(Debug)]
pub enum ApiError {
    DatabaseError(String),
    SerializationError(String),
    CommonError(String),
}

impl std::fmt::Display for ApiError {
    fn fmt(&self, f: &mut std::fmt::Formatter) -> std::fmt::Result {
        match self {
            ApiError::DatabaseError(msg) => write!(f, "Database error: {}", msg),
            ApiError::SerializationError(msg) => write!(f, "Serialization error: {}", msg),
            ApiError::CommonError(msg) => write!(f, "Common error: {}", msg),
        }
    }
}

impl error::Error for ApiError { }

impl From<MongoError> for ApiError {
    fn from(error: MongoError) -> Self {
        ApiError::DatabaseError(error.to_string())
    }
}

impl From<SerdeError> for ApiError {
    fn from(error: SerdeError) -> Self {
        ApiError::SerializationError(error.to_string())
    }
}

impl From<base64::DecodeError> for ApiError {
    fn from(error: base64::DecodeError) -> Self {
        ApiError::SerializationError(error.to_string())
    }
}

impl From<bson::oid::Error> for ApiError {
    fn from(error: bson::oid::Error) -> Self {
        ApiError::SerializationError(error.to_string())
    }
}

impl From<&str> for ApiError {
    fn from(error: &str) -> Self {
        ApiError::CommonError(error.to_string())
    }
}

impl From<ParseError> for ApiError {
    fn from(error: ParseError) -> Self {
        ApiError::CommonError(error.to_string())
    }
}

impl ResponseError for ApiError { }