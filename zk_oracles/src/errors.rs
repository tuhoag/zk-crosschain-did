use std::net::AddrParseError;
use alloy::transports::{RpcError, TransportErrorKind};
use thiserror::Error;

#[derive(Error, Debug)]
pub enum OracleError {
    #[error("Common Error: {0}")]
    CommonError(String),

    #[error("AddrParseError: {0}")]
    AddressParseError(#[from] AddrParseError),

    #[error("UrlParseError: {0}")]
    UrlParseError(#[from] url::ParseError),

    #[error("Tonic Server Error: {0}")]
    ServerError(#[from] tonic::transport::Error),

    #[error("Unknown error")]
    UnknownError(#[from] std::io::Error),

    #[error("Serde JSON Error: {0}")]
    SerdeJsonError(#[from] serde_json::Error),

    #[error("Chain ID {0} or Contract {1} not found in deployment info")]
    ContractNotDeployedOnChainError(u64, String),

    #[error("Hex Parse Error: {0}")]
    HexParseError(#[from] alloy::hex::FromHexError),

    #[error("Contract Error: {0}")]
    ContractError(#[from] alloy::contract::Error),

    #[error("Pending Transaction Error: {0}")]
    PendingContractError(#[from] alloy::providers::PendingTransactionError),

    #[error("DB Error: {0}")]
    DatabaseError(#[from] mongodb::error::Error),

    #[error("Transport Error: {0}")]
    WebSocketError(#[from] RpcError<TransportErrorKind>),

    #[error("Solidity Encoding Error: {0}")]
    SolidityError(#[from] alloy_sol_types::Error),

    #[error("Api Calling Error: {0}")]
    ApiCallingError(#[from] reqwest::Error),

    #[error("Tonic gRPC Error: {0}")]
    RPCError(#[from] tonic::Status),
}

pub type OracleResult<T> = Result<T, OracleError>;