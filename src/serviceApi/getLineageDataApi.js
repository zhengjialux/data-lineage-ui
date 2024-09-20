import axios from "axios"
import lineageData from "../mock/getLineage.json"
import flinkLineageData from "../mock/_getLineage.json"

export const getLineageDataByFQN = (params) => {
    return new Promise((resolve, reject) => {
        resolve(lineageData)
    })
}

export const getLineageDataByFlink = (params) => {
    return new Promise((resolve, reject) => {
        resolve(flinkLineageData)
    })
}