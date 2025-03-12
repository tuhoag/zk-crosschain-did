package utils

import (
	"os"
	"path/filepath"
)

func CreateFilesAt(dirPath string, fileNames []string) ([]os.File, error) {
	// Ensure the directory exists
	err := os.MkdirAll(dirPath, os.ModePerm)
	if err != nil {
		return nil, err
	}

	// Create the files
	results := make([]os.File, len(fileNames))
	for i, fileName := range fileNames {
		filePath := filepath.Join(dirPath, fileName)
		file, err := os.Create(filePath)
		if err != nil {
			return nil, err
		}
		results[i] = *file
	}


	return results, nil
}

func GetBuildDirPath(circuitName string) (string, error) {
	currentDir, err := os.Getwd()
	if err != nil {
		return "", err
	}
	return filepath.Join(currentDir, "build", circuitName), nil
}

func GetOutputDirPath(circuitName, outputDir string) string {
	return filepath.Join(outputDir, circuitName)
}

func OpenFilesAt(dirPath string, fileNames []string) ([]os.File, error) {
	results := make([]os.File, len(fileNames))
	for i, fileName := range fileNames {
		filePath := filepath.Join(dirPath, fileName)
		file, err := os.Open(filePath)
		if err != nil {
			return nil, err
		}
		results[i] = *file
	}

	return results, nil
}

func GetFileNameFromPath(path string) string {
	return filepath.Base(path)
}

func GetR1CSPath(circuitName string) string {
	return filepath.Join("build", circuitName, circuitName + ".r1cs")
}

func GetProvingKeyPath(circuitName string) string {
	return filepath.Join("build", circuitName, circuitName + ".pk")
}

func GetVerifyingKeyPath(circuitName string) string {
	return filepath.Join("build", circuitName, circuitName + ".vk")
}

func GetWitnessPath(circuitName string, witnessName string) string {
	return filepath.Join("build", circuitName, witnessName + ".wtns")
}