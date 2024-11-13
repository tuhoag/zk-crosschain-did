mod command;
use clap::Parser;
use command::MainArgs;

fn main() {
    let args = MainArgs::parse();
    println!("{:?}", args);
}