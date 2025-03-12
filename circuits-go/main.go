package main

import (
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"sync"
	"time"

	"zkssi/circuits"
	"zkssi/utils"
)

func HandleSetup(circuitName string) error {
	println("setup", circuitName)

	buildDir, err := utils.GetBuildDirPath(circuitName)
	if err != nil {
		fmt.Println("Error getting build directory path:", err)
		return err
	}

	if err := os.MkdirAll(buildDir, os.ModePerm); err != nil {
		fmt.Println("Error creating build directory:", err)
		return err
	}

	// Define the file path and directory
	r1csFile, err := os.Create(utils.GetR1CSPath(circuitName))
	if err != nil {
		fmt.Println("Error creating R1CS file:", err)
	}
	defer r1csFile.Close()

	pkFile, err := os.Create(utils.GetProvingKeyPath(circuitName))
	if err != nil {
		fmt.Println("Error creating proving key file:", err)
	}
	defer pkFile.Close()

	vkFile, err := os.Create(utils.GetVerifyingKeyPath(circuitName))
	if err != nil {
		fmt.Println("Error creating verifying key file:", err)
	}
	defer vkFile.Close()

	circuit, err := circuits.GetCircuit(circuitName)
	if err != nil {
		return err
	}

	if err := circuits.Setup(&circuit, r1csFile, pkFile, vkFile); err != nil {
		fmt.Println("failed to setup circuit:", err)
		return err
	}

	return nil
}

func HandleProve(circuitName string, inputPath string, proofPath string) error {
	println("prove", circuitName, inputPath, proofPath)

	if err := os.MkdirAll(filepath.Dir(proofPath), os.ModePerm); err != nil {
		fmt.Println("Error creating proof directory:", err)
		return err
	}

	r1csFile, err := os.Open(utils.GetR1CSPath(circuitName))
	if err != nil {
		fmt.Println("Error opening R1CS file:", err)
		return err
	}
	defer r1csFile.Close()

	pkFile, err := os.Open(utils.GetProvingKeyPath(circuitName))
	if err != nil {
		fmt.Println("Error opening proving key file:", err)
		return err
	}
	defer pkFile.Close()

	inputFile, err := os.Open(inputPath)
	if err != nil {
		fmt.Println("Error opening file:", err)
		return err
	}
	defer inputFile.Close()

	proofFile, err := os.Create(proofPath)
	if err != nil {
		fmt.Println("Error creating proof file:", err)
		return err
	}
	defer proofFile.Close()

	circuit, err := circuits.GetCircuit(circuitName)
	if err != nil {
		fmt.Println("Error getting circuit:", err)
		return err
	}

	if err := circuits.Prove(&circuit, r1csFile, pkFile, inputFile, proofFile); err != nil {
		fmt.Println("Failed to prove circuit:", err)
		return err
	}

	return nil
}

func HandleVerify(circuitName, inputPath, proofPath string) error {
	println("verify", circuitName, inputPath, proofPath)

	vkFile, err := os.Open(utils.GetVerifyingKeyPath(circuitName))
	if err != nil {
		fmt.Println("Error opening verifying key file:", err)
		return err
	}
	defer vkFile.Close()

	inputFile, err := os.Open(inputPath)
	if err != nil {
		fmt.Println("Error opening file:", err)
		return err
	}
	defer inputFile.Close()

	proofFile, err := os.Open(proofPath)
	if err != nil {
		fmt.Println("Error opening proof file:", err)
		return err
	}

	circuit, err := circuits.GetCircuit(circuitName)
	if err != nil {
		fmt.Println("Error getting circuit:", err)
		return err
	}

	if err := circuits.Verify(&circuit, vkFile, proofFile, inputFile); err != nil {
		fmt.Println("Failed to verify circuit:", err)
		return err
	}

	return nil
}

func HandleGenerateVerifier(circuitName string, outputDir string) error {
	println("generate-verifier", circuitName)

	circuit, err := circuits.GetCircuit(circuitName)
	if err != nil {
		fmt.Println("Error getting circuit:", err)
		return err
	}

	contractName := circuitName + "Verifier"
	outputPath := filepath.Join(outputDir, contractName+".sol")
	outputFile, err := os.Create(outputPath)
	if err != nil {
		fmt.Println("Error creating output file:", err)
		return err
	}

	vkFile, err := os.Open(utils.GetVerifyingKeyPath(circuitName))
	if err != nil {
		fmt.Println("Error opening verifying key file:", err)
		return err
	}
	defer vkFile.Close()

	if err := circuits.GenerateVerifier(&circuit, vkFile, outputFile); err != nil {
		fmt.Println("Failed to generate verifier:", err)
		return err
	}

	outputFile.Close()

	if err := ReplaceContractNameInVerifier(outputPath, contractName); err != nil {
		fmt.Println("Failed to replace contract name in verifier:", err)
		return err
	}

	fmt.Println("Verifier generated successfully at:", outputPath)

	return nil
}

func ReplaceContractNameInVerifier(verifierPath, contractName string) error {
	// Read the file content
	verifierFile, err := os.ReadFile(verifierPath)
	if err != nil {
		return err
	}

	// Convert the content to a string
	fileContent := string(verifierFile)

	// Find and replace "contract Verifier" with the new name
	oldText := "contract Verifier"
	newText := "contract " + contractName
	updatedContent := strings.Replace(fileContent, oldText, newText, 1)

	// Write the updated content back to the file
	err = os.WriteFile(verifierPath, []byte(updatedContent), 0644)
	if err != nil {
		return err
	}

	return nil
}

func monitorMemory1() {
	var maxAlloc uint64
	ticker := time.NewTicker(5000 * time.Microsecond)

	go func() {
		for range ticker.C {
			var memStats runtime.MemStats
			runtime.ReadMemStats(&memStats)

			if memStats.Alloc > maxAlloc {
				maxAlloc = memStats.Alloc
			}
			fmt.Printf("Current Alloc: %v KB, Peak Alloc: %v KB\n", memStats.Alloc/1024, maxAlloc/1024)
		}
	}()
}

// Function to monitor memory usage in a goroutine
func monitorMemory(wg *sync.WaitGroup, done chan struct{}) {
	defer wg.Done()

	var maxAlloc uint64
	ticker := time.NewTicker(100 * time.Millisecond) // Check memory every 100ms

	for {
		select {
		case <-done:
			ticker.Stop()
			fmt.Printf("Peak Memory Usage: %v MBs\n", maxAlloc/1024/1000)
			return
		case <-ticker.C:
			var m runtime.MemStats
			runtime.ReadMemStats(&m)
			if m.Alloc > maxAlloc {
				maxAlloc = m.Alloc // Track peak memory usage
			}
		}
	}
}

func main() {
	done := make(chan struct{})
	var wg sync.WaitGroup
	wg.Add(1)
	go monitorMemory(&wg, done)

	startTime := time.Now()
	args := os.Args

	command := args[1]
	circuitName := args[2]

	if command == "setup" {
		HandleSetup(circuitName)
	} else if command == "prove" {
		inputPath := args[3]
		proofPath := args[4]

		HandleProve(circuitName, inputPath, proofPath)
	} else if command == "verify" {
		inputPath := args[3]
		proofPath := args[4]

		HandleVerify(circuitName, inputPath, proofPath)
	} else if command == "generate-verifier" {
		outputPath := args[3]
		HandleGenerateVerifier(circuitName, outputPath)
	} else {
		fmt.Println("Invalid command: ", command)
	}

	elapsedTime := time.Since(startTime)

	close(done)
	wg.Wait()

	fmt.Printf("Total Execution Time: %.2f seconds\n", elapsedTime.Seconds())
}
