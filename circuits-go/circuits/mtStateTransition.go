package circuits

import (
	"github.com/consensys/gnark/frontend"
)

type MTStateTransition struct {
	TransitionTime   [NumNeededMTStatuses]frontend.Variable            `gnark:"transitionTime,public" json:"transitionTime"`
	TransitionStatus [NumNeededMTStatuses]frontend.Variable            `gnark:"transitionStatus,public" json:"transitionStatus"`
	TransitionLeaves [NumNeededMTStatuses][NumLeaves]frontend.Variable `gnark:"transitionLeaves" json:"transitionLeaves"`
}

func (circuit *MTStateTransition) Define(api frontend.API) error {
	for i := 0; i < len(circuit.TransitionStatus); i++ {
		verifyRoot(api, circuit.TransitionStatus[i], circuit.TransitionLeaves[i])
	}

	for i := 1; i < len(circuit.TransitionStatus); i++ {
		verifyTransitionLeaves(api, circuit.TransitionLeaves[i-1], circuit.TransitionLeaves[i])
	}

	return nil
}

func additionHash(api frontend.API, a, b frontend.Variable) frontend.Variable {
	result := api.Add(a, b)
	return result
}

func verifyRoot(api frontend.API, rootHash frontend.Variable, leaves [NumLeaves]frontend.Variable) error {
	// Compute the Merkle root
	currentLevel := leaves[:]
	for len(currentLevel) > 1 {
		var nextLevel []frontend.Variable
		for i := 0; i < len(currentLevel); i += 2 {
			// Hash pairs of nodes to compute the parent level
			parent := additionHash(api, currentLevel[i], currentLevel[i+1])
			nextLevel = append(nextLevel, parent)
		}
		currentLevel = nextLevel
	}

	api.AssertIsEqual(currentLevel[0], rootHash)

	return nil
}

func verifyTransitionLeaves(api frontend.API, leaves1 [NumLeaves]frontend.Variable, leaves2 [NumLeaves]frontend.Variable) error {
	for i := 0; i < len(leaves1); i++ {
		l1 := api.Select(api.IsZero(leaves1[i]), leaves2[i], leaves1[i])
		api.AssertIsEqual(l1, leaves2[i])
	}
	return nil
}
