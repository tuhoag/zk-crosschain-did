use alloy::dyn_abi::DynSolValue;

#[derive(Debug, PartialEq, Eq)]
pub struct Oracle {
    pub id: u8,
    pub oracle_address: String,
    pub url: String,
    pub amount: u64,
}

impl From<DynSolValue> for Oracle {
    fn from(value: DynSolValue) -> Self {
        // println!("{:?}", value);
        let tuple = value.as_tuple().unwrap();

        Self {
            id: tuple[0].as_uint().unwrap().0.to::<u8>(),
            oracle_address: tuple[1].as_address().unwrap().to_string(),
            url: tuple[2].as_str().unwrap().to_string(),
            amount: tuple[3].as_uint().unwrap().0.to::<u64>(),
        }
    }
}