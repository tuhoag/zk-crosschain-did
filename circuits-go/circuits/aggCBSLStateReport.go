package circuits

import (
	"github.com/consensys/gnark/frontend"
	// "github.com/consensys/gnark/std/math/cmp"
)

type AggCBSLStateReport struct {
	// previous state
	PreviousTime     frontend.Variable           `gnark:"previousTime,public" json:"previousTime"`
	PreviousStatuses [DataSize]frontend.Variable `gnark:"previousStatuses,public" json:"previousStatuses"`

	// final state
	FinalTransitionTimes   [NumStatuses]frontend.Variable `gnark:"finalTransitionTimes,public" json:"finalTransitionTimes"`
	FinalTransitionIndexes [NumStatuses]frontend.Variable `gnark:"finalTransitionIndexes,public" json:"finalTransitionIndexes"`
	FinalTransitionChanges [NumStatuses]frontend.Variable `gnark:"finalTransitionChanges,public" json:"finalTransitionChanges"`

	// reports
	ReportTimes   [NumOracles][NumStatuses]frontend.Variable `gnark:"reportTimes" json:"reportTimes"`
	ReportIndexes [NumOracles][NumStatuses]frontend.Variable `gnark:"reportIndexes" json:"reportIndexes"`
	ReportChanges [NumOracles][NumStatuses]frontend.Variable `gnark:"reportChanges" json:"reportChanges"`

	// indicators
	Indicator frontend.Variable `gnark:"indicator,public" json:"indicator"`
	F         frontend.Variable `gnark:"f,public" json:"f"`
}

func HasOneBit(api frontend.API, x frontend.Variable) frontend.Variable {
	// bits := api.ToBinary(x, 256)

	// count := frontend.Variable(0)
	// for i := 1; i < 256; i++ {
	// 	println(bits[i])
	// 	count = api.Add(count, bits[i])
	// }

	// return IsEqual(api, count, frontend.Variable(1))
	// oneLess := api.Sub(c.X, 1) // x - 1
	// check := api.And(c.X, oneLess) // x & (x - 1)
	// api.AssertIsZero(check) // Assert that the result is zero (this means only one 1-bit)

	oneLess := api.Sub(x, 1)
	check := api.And(x, oneLess)
	greaterThanZero := api.Cmp(x, 0)
	return api.And(IsEqual(api, greaterThanZero, 1), api.IsZero(check))
}

func DifferenceInOneBit(api frontend.API, x frontend.Variable, y frontend.Variable) frontend.Variable {
	// diff := api.Sub(x, y)
	// oneLess := api.Sub(diff, 1)
	// check := api.And(diff, oneLess)
	// return api.IsZero(check)
	// api.X
	return HasOneBit(api, api.Sub(x, y))
}

func CountDifferences(api frontend.API, xBits []frontend.Variable, yBits []frontend.Variable) frontend.Variable {
	count := frontend.Variable(0)
	for i := 0; i < len(xBits); i++ {
		dif := api.Xor(xBits[i], yBits[i])
		count = api.Add(count, dif)
	}
	return count
}

func Count1Bits(api frontend.API, xBits []frontend.Variable) frontend.Variable {
	count := frontend.Variable(0)
	for i := 0; i < len(xBits); i++ {
		count = api.Add(count, xBits[i])
	}
	return count
}

func IsValidTimeAndChanges(api frontend.API, previousTime frontend.Variable, transitionTimes, transitionIndexes, transitionChanges [NumStatuses]frontend.Variable) frontend.Variable {
	// check time
	preTime := previousTime
	for i := 0; i < NumStatuses; i++ {
		api.AssertIsLessOrEqual(preTime, api.Sub(transitionTimes[i], 1))
		preTime = transitionTimes[i]

		api.AssertIsLessOrEqual(transitionIndexes[i], api.Sub(frontend.Variable(DataSize), 1))
	}

	var finalStatusesBits [NumStatuses][]frontend.Variable
	for i := 0; i < NumStatuses; i++ {
		finalStatusesBits[i] = api.ToBinary(transitionChanges[i], 256)
		num1Bits := Count1Bits(api, finalStatusesBits[i])
		api.AssertIsEqual(num1Bits, 1)
	}

	return frontend.Variable(1)
}

func (circuit *AggCBSLStateReport) Define(api frontend.API) error {
	// count only one 1-bit in each state
	isFinalChangesValid := IsValidTimeAndChanges(api, circuit.PreviousTime, circuit.FinalTransitionTimes, circuit.FinalTransitionIndexes, circuit.FinalTransitionChanges)
	api.AssertIsEqual(isFinalChangesValid, 1)

	// check reports
	indicatorBits := api.ToBinary(circuit.Indicator, NumOracles)
	for i := 0; i < NumOracles; i++ {
		isReportValid := IsValidTimeAndChanges(api, circuit.PreviousTime, circuit.ReportTimes[i], circuit.ReportIndexes[i], circuit.ReportChanges[i])
		api.AssertIsEqual(indicatorBits[i], isReportValid)
	}

	// check votes
	requiredVotes := api.Add(circuit.F, 1)

	for i := 0; i < NumStatuses; i++ {
		count := frontend.Variable(0)

		for j := 0; j < NumOracles; j++ {
			isTimeEqual := IsEqual(api, circuit.FinalTransitionTimes[i], circuit.ReportTimes[j][i])
			isStateEqual := IsEqual(api, circuit.FinalTransitionChanges[i], circuit.ReportChanges[j][i])
			isIndexEqual := IsEqual(api, circuit.FinalTransitionIndexes[i], circuit.ReportIndexes[j][i])
			count = api.Add(count, api.And(isTimeEqual, api.And(isStateEqual, isIndexEqual)))
		}

		api.AssertIsLessOrEqual(requiredVotes, count)
	}

	return nil
}
