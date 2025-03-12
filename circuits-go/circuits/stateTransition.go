package circuits

import (
	"github.com/consensys/gnark/frontend"
)

type StateTransition struct {
	MiddleTimes      [NumMiddleStatuses]frontend.Variable `gnark:"middleTimes" json:"middleTimes"`
	MiddleStatuses   [NumMiddleStatuses]frontend.Variable `gnark:"middleStatuses" json:"middleStatuses"`
	TransitionTime   [2]frontend.Variable                 `gnark:"transitionTime,public" json:"transitionTime"`
	TransitionStatus [2]frontend.Variable                 `gnark:"transitionStatus,public" json:"transitionStatus"`
}

func (circuit *StateTransition) Define(api frontend.API) error {
	preTime := circuit.TransitionTime[0]
	for i := 0; i < len(circuit.MiddleTimes); i++ {
		api.AssertIsLessOrEqual(preTime, circuit.MiddleTimes[i])
		preTime = circuit.MiddleTimes[i]
	}
	api.AssertIsLessOrEqual(preTime, circuit.TransitionTime[1])

	var biStatuses [len(circuit.MiddleStatuses) + 2][]frontend.Variable
	biStatuses[0] = api.ToBinary(circuit.TransitionStatus[0], 64)
	biStatuses[len(biStatuses)-1] = api.ToBinary(circuit.TransitionStatus[1], 64)
	for i := 0; i < len(circuit.MiddleStatuses); i++ {
		biStatuses[i+1] = api.ToBinary(circuit.MiddleStatuses[i], 64)
	}

	for i := 0; i < len(biStatuses)-1; i++ {
		for j := 0; j < len(biStatuses[i]); j++ {
			res := api.And(biStatuses[i][j], biStatuses[i+1][j])
			api.AssertIsEqual(res, biStatuses[i][j])
		}
	}

	return nil
}
