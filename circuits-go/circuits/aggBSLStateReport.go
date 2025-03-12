package circuits

import (
	// "fmt"

	"github.com/consensys/gnark/frontend"
	// "github.com/consensys/gnark/std/math/cmp"
)

type AggBSLStateReport struct {
	// final state
	FinalMiddleTimes      [NumMiddleBigStatuses]frontend.Variable           `gnark:"finalMiddleTimes" json:"finalMiddleTimes"`
	FinalMiddleStatuses   [NumMiddleBigStatuses][DataSize]frontend.Variable `gnark:"finalMiddleStatuses" json:"finalMiddleStatuses"`
	FinalTransitionTime   [2]frontend.Variable                              `gnark:"finalTransitionTime,public" json:"finalTransitionTime"`
	FinalTransitionStatus [2][DataSize]frontend.Variable                    `gnark:"finalTransitionStatus,public" json:"finalTransitionStatus"`

	// reports
	ReportTimes    [NumOracles][NumStatuses]frontend.Variable           `gnark:"reportTimes" json:"reportTimes"`
	ReportStatuses [NumOracles][NumStatuses][DataSize]frontend.Variable `gnark:"reportStatuses" json:"reportStatuses"`

	// indicators
	Indicator frontend.Variable `gnark:"indicator,public" json:"indicator"`
	F         frontend.Variable `gnark:"f,public" json:"f"`
}

func (circuit *AggBSLStateReport) Define(api frontend.API) error {
	finalStateCircuit := BigStateTransition{
		MiddleTimes:      circuit.FinalMiddleTimes,
		MiddleStatuses:   circuit.FinalMiddleStatuses,
		TransitionTime:   circuit.FinalTransitionTime,
		TransitionStatus: circuit.FinalTransitionStatus,
	}

	// check aggregated report's transition & time
	if err := finalStateCircuit.Define(api); err != nil {
		return err
	}

	// check reports & indicators
	indicatorBits := api.ToBinary(circuit.Indicator, NumOracles)

	middleTimes := [NumMiddleBigStatuses]frontend.Variable{}
	middleTimes[NumMiddleBigStatuses-1] = circuit.FinalTransitionTime[1]

	middleStatuses := [NumMiddleBigStatuses][DataSize]frontend.Variable{}
	middleStatuses[NumMiddleBigStatuses-1] = circuit.FinalTransitionStatus[1]

	for i := 0; i < NumOracles; i++ {
		for j := 0; j < NumMiddleBigStatuses-1; j++ {
			middleTimes[j] = circuit.ReportTimes[i][j]
			middleStatuses[j] = circuit.ReportStatuses[i][j]
		}

		reportStateCircuit := BigStateTransition{
			MiddleTimes:      middleTimes,
			MiddleStatuses:   middleStatuses,
			TransitionTime:   [2]frontend.Variable{circuit.FinalTransitionTime[0], circuit.ReportTimes[i][NumStatuses-1]},
			TransitionStatus: [2][DataSize]frontend.Variable{circuit.FinalTransitionStatus[0], circuit.ReportStatuses[i][NumStatuses-1]},
		}

		curValidity := 1
		if err := reportStateCircuit.Define(api); err != nil {
			curValidity = 0
		}

		api.AssertIsEqual(indicatorBits[i], curValidity)
	}

	requiredVotes := api.Add(circuit.F, 1)

	for i := 0; i < NumMiddleBigStatuses; i++ {
		count := frontend.Variable(0)

		for j := 0; j < NumOracles; j++ {
			isTimeEqual := IsEqual(api, circuit.FinalMiddleTimes[i], circuit.ReportTimes[j][i])
			isStateEqual := frontend.Variable(1)
			for k := 0; k < DataSize; k++ {
				isStateEqual = api.And(isStateEqual, IsEqual(api, circuit.FinalMiddleStatuses[i][k], circuit.ReportStatuses[j][i][k]))
			}
			count = api.Add(count, api.And(isTimeEqual, isStateEqual))
		}

		api.AssertIsLessOrEqual(requiredVotes, count)
	}

	return nil
}
