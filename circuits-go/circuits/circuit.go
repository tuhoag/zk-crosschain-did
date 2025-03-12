package circuits

import (
	"encoding/json"
	"fmt"
	"io"

	"github.com/consensys/gnark-crypto/ecc"
	"github.com/consensys/gnark/backend/groth16"
	"github.com/consensys/gnark/frontend"
	"github.com/consensys/gnark/frontend/cs/r1cs"
)

const (
	NumStatuses           = 10
	NumMiddleBigStatuses  = NumStatuses - 1
	DataSize              = 7
	Height                = 15
	NumLeaves             = 1 << Height
	NumNeededMTStatuses   = NumStatuses + 1
	NumMiddleStatuses     = NumStatuses - 1
	NumNeededCBSLStatuses = NumStatuses + 1
	NumOracles            = 4
)

type MyCircuit interface {
	Define(api frontend.API) error
}

func GetCircuit(circuitName string) (MyCircuit, error) {
	switch circuitName {
	case "StateTransition":
		return &StateTransition{}, nil
	case "BigStateTransition":
		return &BigStateTransition{}, nil
	case "MTStateTransition":
		return &MTStateTransition{}, nil
	case "SingleMTStateTransition":
		return &SingleMTStateTransition{}, nil
	case "AggBSLStateReport":
		return &AggBSLStateReport{}, nil
	case "AggMTStateReport":
		return &AggMTStateReport{}, nil
	case "AggCBSLStateReport":
		return &AggCBSLStateReport{}, nil
	default:
		return nil, fmt.Errorf("circuit not found: %s", circuitName)
	}
}

func Setup(circuit *MyCircuit, ccsWriter, pkWriter, vkWriter io.Writer) error {
	ccs, err := frontend.Compile(ecc.BN254.ScalarField(), r1cs.NewBuilder, *circuit)
	if err != nil {
		return err
	}

	_, err = ccs.WriteTo(ccsWriter)
	if err != nil {
		return err
	}

	pk, vk, err := groth16.Setup(ccs)
	if err != nil {
		return err
	}

	_, err = pk.WriteRawTo(pkWriter)
	if err != nil {
		return err
	}

	_, err = vk.WriteRawTo(vkWriter)
	if err != nil {
		return err
	}

	return nil
}

func LoadInputs(circuit *MyCircuit, inputReader io.Reader) error {
	decoder := json.NewDecoder(inputReader)
	err := decoder.Decode(&circuit)
	if err != nil {
		return err
	}

	// jsonData, err := json.Marshal(circuit)
	// if err != nil {
	// 	fmt.Println("Error converting to JSON:", err)
	// 	return err
	// }

	// Print JSON string
	// fmt.Println(string(jsonData))
	return nil
}

func Prove(circuit *MyCircuit, r1csReader, pkReader, inputReader io.Reader, proofWriter io.Writer) error {
	r1cs := groth16.NewCS(ecc.BN254)
	r1cs.ReadFrom(r1csReader)

	pk := groth16.NewProvingKey(ecc.BN254)
	pk.ReadFrom(pkReader)

	err := LoadInputs(circuit, inputReader)
	if err != nil {
		return err
	}

	// println(circuit.MiddleTimes)
	// println("Reading witness...")
	witness, err := frontend.NewWitness(*circuit, ecc.BN254.ScalarField())
	if err != nil {
		return err
	}

	proof, err := groth16.Prove(r1cs, pk, witness)
	if err != nil {
		return err
	}

	proof.WriteRawTo(proofWriter)

	return nil
}

func Verify(circuit *MyCircuit, vkReader, proofReader, publicWitnessReader io.Reader) error {
	vk := groth16.NewVerifyingKey(ecc.BN254)
	vk.ReadFrom(vkReader)

	proof := groth16.NewProof(ecc.BN254)
	proof.ReadFrom(proofReader)

	err := LoadInputs(circuit, publicWitnessReader)
	if err != nil {
		return err
	}

	pubWitness, err := frontend.NewWitness(*circuit, ecc.BN254.ScalarField(), frontend.PublicOnly())
	if err != nil {
		return err
	}

	err = groth16.Verify(proof, vk, pubWitness)
	if err != nil {
		return err
	}

	return nil
}

func GenerateVerifier(circuit *MyCircuit, vkReader io.Reader, outputWriter io.Writer) error {
	vk := groth16.NewVerifyingKey(ecc.BN254)
	if _, err := vk.ReadFrom(vkReader); err != nil {
		return err
	}

	if err := vk.ExportSolidity(outputWriter); err != nil {
		return err
	}

	return nil
}
