package circuits

import (
	"github.com/consensys/gnark/frontend"
)

// const (
// 	Height = 2
// 	NumLeaves = 1 << Height
// );


type SingleMTStateTransition struct {
	TransitionTime [2]frontend.Variable `gnark:"transitionTime,public" json:"transitionTime"`
	TransitionStatus [2]frontend.Variable `gnark:"transitionStatus,public" json:"transitionStatus"`
	TransitionLeaves [2][NumLeaves]frontend.Variable `gnark:"transitionLeaves" json:"transitionLeaves"`
}

func (circuit *SingleMTStateTransition) Define(api frontend.API) error {
	// Compute the Merkle root

	verifyRoot(api, circuit.TransitionStatus[0], circuit.TransitionLeaves[0])
	verifyRoot(api, circuit.TransitionStatus[1], circuit.TransitionLeaves[1])

	verifyTransitionLeaves(api, circuit.TransitionLeaves[0], circuit.TransitionLeaves[1])

	return nil
}