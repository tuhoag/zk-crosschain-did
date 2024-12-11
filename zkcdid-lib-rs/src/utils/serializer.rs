use std::collections::HashMap;

use serde::{Deserialize, Deserializer, Serializer};
use bson::oid::ObjectId;
use base64::{engine::general_purpose, Engine};
use serde::de::Error as DeError;

pub fn u64_to_base64<S>(num: &u64, serializer: S) -> Result<S::Ok, S::Error>
where
    S: Serializer,
{
    let num_bytes = num.to_be_bytes(); // Convert u64 to bytes
    let base64_encoded = general_purpose::STANDARD.encode(&num_bytes); // Encode bytes to Base64
    serializer.serialize_str(&base64_encoded) // Serialize as a string
}

// Custom deserialization function to convert Base64 string to `u64`
pub fn base64_to_u64<'de, D>(deserializer: D) -> Result<u64, D::Error>
where
    D: Deserializer<'de>,
{
    let base64_str: &str = Deserialize::deserialize(deserializer)?;
    let decoded_bytes = general_purpose::STANDARD.decode(base64_str).map_err(serde::de::Error::custom)?;

    // Ensure the decoded bytes have the correct length for a `u64` (8 bytes)
    if decoded_bytes.len() != 8 {
        return Err(serde::de::Error::custom("Invalid length for u64"));
    }

    // Convert bytes to u64
    let mut num_bytes = [0u8; 8];
    num_bytes.copy_from_slice(&decoded_bytes);
    Ok(u64::from_be_bytes(num_bytes))
}

// Serialize `ObjectId` as a simple string
pub fn serialize_object_id_as_string<S>(object_id: &Option<ObjectId>, serializer: S) -> Result<S::Ok, S::Error>
where
    S: Serializer,
{
    // println!("serialize object id: {:?}", object_id);
    match object_id {
        Some(oid) => serializer.serialize_str(&oid.to_hex()), // Convert ObjectId to hex string
        None => serializer.serialize_none(),
    }
}

// Deserialize `ObjectId` from a string
pub fn deserialize_object_id<'de, D>(deserializer: D) -> Result<Option<ObjectId>, D::Error>
where
    D: Deserializer<'de>,
{
    // let t: HashMap<String, String> = Deserialize::deserialize(deserializer)?;
    // println!("deserialize object id: {:?}", t);
    // println!("is human readable: {:?}", deserializer.is_human_readable());

    let str_id;
    if deserializer.is_human_readable() {
        // println!("deserialize object id human readable");
        match Option::<String>::deserialize(deserializer) {
            Ok(s) => {
                // println!("deserialize object id s: {:?}", s);
                str_id = s.unwrap();
            },
            Err(e) => {
                // println!("deserialize object id error: {:?}", e);
                return Err(e);
            }
        };
    } else {
        // println!("deserialize object id not human readable");
        match Option::<HashMap<String, String>>::deserialize(deserializer) {
            Ok(s) => {
                // println!("deserialize object id s: {:?}", s);
                let deserialized_data = s.unwrap();
                match deserialized_data.get("$oid") {
                    Some(s2) => {
                        str_id = s2.to_string();
                    },
                    None => {
                        return Err(DeError::custom("$oid is not included"));
                    }
                };
            },
            Err(e) => {
                // println!("deserialize object id error: {:?}", e);
                return Err(e);
            }
        };
    }

    if str_id.is_empty() {
        return Ok(None);
    }

    match ObjectId::parse_str(&str_id) {
        Ok(parsed_id) => {
            // println!("parse str object id: {:?}", parsed_id);
            return Ok(Some(parsed_id));
        },
        Err(e) => {
            // println!("parse str object id error: {:?}", e);
            return Err(DeError::custom(e));
        }
    }
    // Ok(None)
}