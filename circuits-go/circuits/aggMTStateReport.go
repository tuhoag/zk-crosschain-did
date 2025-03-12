package circuits

import (
	"github.com/consensys/gnark/frontend"
)

type AggMTStateReport struct {
	FinalTransitionTime   [NumNeededMTStatuses]frontend.Variable            `gnark:"finalTransitionTime,public" json:"finalTransitionTime"`
	FinalTransitionStatus [NumNeededMTStatuses]frontend.Variable            `gnark:"finalTransitionStatus,public" json:"finalTransitionStatus"`
	FinalTransitionLeaves [NumNeededMTStatuses][NumLeaves]frontend.Variable `gnark:"finalTransitionLeaves" json:"finalTransitionLeaves"`

	ReportTransitionTime   [NumOracles][NumNeededMTStatuses]frontend.Variable            `gnark:"reportTransitionTime" json:"reportTransitionTime"`
	ReportTransitionStatus [NumOracles][NumNeededMTStatuses]frontend.Variable            `gnark:"reportTransitionStatus" json:"reportTransitionStatus"`
	ReportTransitionLeaves [NumOracles][NumNeededMTStatuses][NumLeaves]frontend.Variable `gnark:"reportTransitionLeaves" json:"reportTransitionLeaves"`

	Indicator frontend.Variable `gnark:"indicator,public" json:"indicator"`
	F         frontend.Variable `gnark:"f,public" json:"f"`
}

func IsEqual(api frontend.API, a, b frontend.Variable) frontend.Variable {
	diff := api.Sub(a, b)
	return api.Select(api.IsZero(diff), 1, 0)
}

func (circuit *AggMTStateReport) Define(api frontend.API) error {
	finalStateCircuit := MTStateTransition{
		TransitionTime:   circuit.FinalTransitionTime,
		TransitionStatus: circuit.FinalTransitionStatus,
		TransitionLeaves: circuit.FinalTransitionLeaves,
	}

	if err := finalStateCircuit.Define(api); err != nil {
		return err
	}

	indicatorBits := api.ToBinary(circuit.Indicator, NumOracles)

	for i := 0; i < NumOracles; i++ {
		reportStateCircuit := MTStateTransition{
			TransitionTime:   circuit.ReportTransitionTime[i],
			TransitionStatus: circuit.ReportTransitionStatus[i],
			TransitionLeaves: circuit.ReportTransitionLeaves[i],
		}

		curValidity := 1
		if err := reportStateCircuit.Define(api); err != nil {
			curValidity = 0
		}

		api.AssertIsEqual(indicatorBits[i], curValidity)
	}

	requiredVotes := api.Add(circuit.F, 1)

	for i := 0; i < NumNeededMTStatuses; i++ {
		count := frontend.Variable(0)

		for j := 0; j < NumOracles; j++ {
			isTimeEqual := IsEqual(api, circuit.FinalTransitionTime[i], circuit.ReportTransitionTime[j][i])
			isStateEqual := IsEqual(api, circuit.FinalTransitionStatus[i], circuit.ReportTransitionStatus[j][i])

			count = api.Add(count, api.And(isTimeEqual, isStateEqual))
		}

		api.AssertIsLessOrEqual(requiredVotes, count)
	}

	return nil
}
