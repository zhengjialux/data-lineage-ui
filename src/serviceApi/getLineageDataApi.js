import axios from "axios"
import lineageData from "../mock/getLineage.json"

export const getLineageDataByFQN = (params) => {
    return new Promise((resolve, reject) => {
        resolve(lineageData)
    })
}