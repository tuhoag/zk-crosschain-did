package circuits

import (
	"github.com/consensys/gnark/frontend"
)

type BigStateTransition struct {
	MiddleTimes      [NumMiddleBigStatuses]frontend.Variable           `gnark:"middleTimes" json:"middleTimes"`
	MiddleStatuses   [NumMiddleBigStatuses][DataSize]frontend.Variable `gnark:"middleStatuses" json:"middleStatuses"`
	TransitionTime   [2]frontend.Variable                              `gnark:"transitionTime,public" json:"transitionTime"`
	TransitionStatus [2][DataSize]frontend.Variable                    `gnark:"transitionStatus,public" json:"transitionStatus"`
}

func ConvertDataToBits(api frontend.API, data [DataSize]frontend.Variable) [DataSize][]frontend.Variable {
	var res [DataSize][]frontend.Variable
	for i := 0; i < DataSize; i++ {
		res[i] = api.ToBinary(data[i], 256)
	}
	return res
}

func VerifyBSLTimesTransition(api frontend.API, transitionTimes [2]frontend.Variable, times [NumMiddleBigStatuses]frontend.Variable) {
	preTime := transitionTimes[0]

	for i := 0; i < len(times); i++ {
		api.AssertIsLessOrEqual(preTime, times[i])
		preTime = times[i]
	}

	api.AssertIsLessOrEqual(preTime, transitionTimes[1])
}

func VerifyBSLStatus(api frontend.API, transitionStatus [2][DataSize]frontend.Variable, middleStatuses [NumMiddleBigStatuses][DataSize]frontend.Variable) {
	var biStatuses [len(middleStatuses) + 2][DataSize][]frontend.Variable
	biStatuses[0] = ConvertDataToBits(api, transitionStatus[0])
	biStatuses[len(biStatuses)-1] = ConvertDataToBits(api, transitionStatus[1])

	for i := 0; i < len(middleStatuses); i++ {
		biStatuses[i+1] = ConvertDataToBits(api, middleStatuses[i])
	}

	for i := 0; i < len(biStatuses)-1; i++ {
		for j := 0; j < len(biStatuses[i]); j++ {
			for k := 0; k < len(biStatuses[i][j]); k++ {
				res := api.And(biStatuses[i][j][k], biStatuses[i+1][j][k])
				api.AssertIsEqual(res, biStatuses[i][j][k])
			}
		}
	}
}

func (circuit *BigStateTransition) Define(api frontend.API) error {
	VerifyBSLTimesTransition(api, circuit.TransitionTime, circuit.MiddleTimes)
	VerifyBSLStatus(api, circuit.TransitionStatus, circuit.MiddleStatuses)

	return nil
}
