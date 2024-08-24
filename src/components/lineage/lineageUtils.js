import { isUndefined, cloneDeep, uniqWith, isEqual, uniqueId, isNil, isEmpty } from 'lodash'
import { graphlib, layout } from '@dagrejs/dagre'
import { 
  EntityType, 
  EntityLineageNodeType, 
  Position, 
  MarkerType, 
  ZOOM_VALUE, 
  ZOOM_TRANSITION_DURATION, 
  NODE_WIDTH, 
  NODE_HEIGHT,
  EntityLineageDirection
} from './entity.enum'
import { t } from 'i18next';
import CustomEdge from './CustomEdge'
import CustomNode from './CustomNode'
import LoadMoreNode from './LoadMoreNode'

export const nodeTypes = {
  output: CustomNode,
  input: CustomNode,
  default: CustomNode,
  'load-more': LoadMoreNode,
};

export const customEdges = { buttonedge: CustomEdge };

// 加密
export const encodeLineageHandles = (handle) => {
  return btoa(encodeURIComponent(handle));
};

// 解密
export const decodeLineageHandles = (handle) => {
  return handle ? decodeURIComponent(atob(handle)) : handle;
};

// 解密获取句柄值
export const getColumnSourceTargetHandles = (obj = {}) => {
  const { sourceHandle, targetHandle } = obj;

  return {
    sourceHandle: decodeLineageHandles(sourceHandle),
    targetHandle: decodeLineageHandles(targetHandle),
  };
};

export const getChildMap = (lineageData, ownerName) => {
    const nodeSet = new Set();
    const parsedNodes = []

    nodeSet.add(lineageData.entity.id)

    // 上下游关系整理分类
    const data = getUpstreamDownstreamNodesEdges(
        lineageData.edges ?? [],
        lineageData.nodes ?? [],
        ownerName
    )

    // 创建一个新的血缘数据对象备用
    const newData = cloneDeep(lineageData)
    // 去重赋值
    newData.upstreamEdges = uniqWith(data.upstreamEdges, isEqual);
    newData.downstreamEdges = uniqWith(data.downstreamEdges, isEqual);
    // 分析上游数据格式
    const parentsMap = getLineageChildParents(newData, nodeSet, parsedNodes, lineageData.entity.id, true)
    // 分析下游数据格式
    const childMap = getLineageChildParents(newData, nodeSet, parsedNodes, lineageData.entity.id, false)

    // 返回结果
    return { 
        map: { 
            ...lineageData.entity,  // 当前源节点属性
            parents: parentsMap, // 血缘上游关系
            children: childMap  // 血缘下游关系
        } 
    }
}

export const getPaginatedChildMap = (
    lineageData,  // 全量数据（节点，连线）
    childMap,
    pagination_data,
    maxLineageLength,  // 血缘最大呈现的数量
) => {
    const nodes = []  // 节点数据
    const edges = []  // 连线数据
    nodes.push(lineageData.entity)

    if (childMap) {
        // 下层数据处理超出最大限制处理
        flattenObj(lineageData, childMap, lineageData.entity.id, nodes, edges, pagination_data, {
            downwards: true,  // 下层
            maxLineageLength,  // 最大血缘数量
        })
        // 上层数据处理超出最大限制处理
        flattenObj(lineageData, childMap, lineageData.entity.id, nodes, edges, pagination_data, {
            downwards: false,  // 上层
            maxLineageLength,  // 最大血缘数量
        })
    }

    // 返回处理结果
    return { nodes, edges }
}

// 创建血缘组件需要的节点数据格式
export const createNodes = (
    nodesData,
    edgesData,
    entityFqn,
    isExpanded
) => {
    // 容错 + 排序
    const uniqueNodesData = removeDuplicateNodes(nodesData).sort((a, b) =>
        getEntityName(a).localeCompare(getEntityName(b))
    );

    // 创建 graphlib 实例
    const GraphInstance = graphlib.Graph
    const graph = new GraphInstance()
    graph.setGraph({
        rankdir: 'LR'
    })
    graph.setDefaultEdgeLabel(() => ({}))

    // 计算高度 + 添加到画布
    uniqueNodesData.forEach(node => {
        const { childrenHeight } = getEntityChildrenAndLabel(node);
        const nodeHeight = isExpanded ? childrenHeight + 220 : NODE_HEIGHT
        graph.setNode(node.id, { width: NODE_HEIGHT, height: nodeHeight })
    })
    // 对节点进行连线
    edgesData.forEach(edge => {
        graph.setEdge(edge.fromEntity.id, edge.toEntity.id)
    })

    // 渲染
    layout(graph)
    
    // 获取布局中的节点
    const layoutPositions = graph.nodes().map((nodeId) => graph.node(nodeId))
    // 返回处理好的血缘数据集
    return uniqueNodesData.map((node, index) => {
        const position = layoutPositions[index]
        // 节点类型
        const type = node.type === EntityLineageNodeType.LOAD_MORE ? node.type : getNodeType(edgesData, node.id)
        return {
            id: node.id,
            sourcePosition: Position.Right,
            targetPosition: Position.Left,
            type,
            className: '',
            data: {
                node,
                isRootNode: entityFqn === node.fullyQualifiedName,
            },
            position: {
                x: position.x - NODE_WIDTH / 2,
                y: position.y - NODE_HEIGHT / 2
            }
        }
    })
}

// 创建血缘组件需要的连线数据格式
export const createEdges = (
    nodesData,
    edgesData,
    entityFqn,
) => {
    const lineageEdgesV1 = []
    const edgeIds = new Set()
    const columnsHavingLineage = new Set()
    edgesData.forEach(edge => {
        // 找到连接线的源头节点
        const sourceType = nodesData.find((n) => edge.fromEntity.id === n.id);
        // 找到连接线的目标节点
        const targetType = nodesData.find((n) => edge.toEntity.id === n.id);
        // 容错处理
        if (isUndefined(sourceType) || isUndefined(targetType)) { return }
        // 字段的连线生成
        if (!isUndefined(edge.columns)) {
            edge.columns?.forEach((e) => {
                const toColumn = e.toColumn ?? '';
                // 有目标字段，并且目标字段可能由多个源头字段加工出来的，所以是个数组
                if (toColumn && e.fromColumns && e.fromColumns.length > 0) {
                    e.fromColumns.forEach((fromColumn) => {
                        // 血缘中字段有关联的都存起来，因为是个 Set 实例对象，会内部去重
                        columnsHavingLineage.add(fromColumn);
                        columnsHavingLineage.add(toColumn);
                        // 加密生成唯一ID
                        const encodedFromColumn = encodeLineageHandles(fromColumn);
                        const encodedToColumn = encodeLineageHandles(toColumn);
                        const edgeId = `column-${encodedFromColumn}-${encodedToColumn}-edge-${edge.fromEntity.id}-${edge.toEntity.id}`;
                        // 性能优化
                        if (!edgeIds.has(edgeId)) {
                            edgeIds.add(edgeId);
                            // 生成节点下具体字段连接线呈现对象
                            // source、target 关联的节点
                            // targetHandle、sourceHandle 具体连接的字段
                            lineageEdgesV1.push({
                                id: edgeId,
                                source: edge.fromEntity.id,
                                target: edge.toEntity.id,
                                targetHandle: encodedToColumn,
                                sourceHandle: encodedFromColumn,
                                style: { strokeWidth: '2px' },
                                type: 'buttonedge',
                                // type: 'default',
                                markerEnd: {
                                    type: MarkerType.ArrowClosed,
                                },
                                data: {
                                    edge,
                                    isColumnLineage: true,
                                    targetHandle: encodedToColumn,
                                    sourceHandle: encodedFromColumn,
                                    fromColumns: e.fromColumns
                                },
                            });
                        }
                    })
                }
            })
        }
        // 节点的连线生成（与字段连线一样）
        const edgeId = `edge-${edge.fromEntity.id}-${edge.toEntity.id}`;
        if (!edgeIds.has(edgeId)) {
            edgeIds.add(edgeId);
            // 生成节点连接线呈现对
            lineageEdgesV1.push({
                id: edgeId,
                source: edge.fromEntity.id,
                target: edge.toEntity.id,
                type: 'buttonedge',
                // type: 'default',
                animated: !isNil(edge.pipeline),
                style: { strokeWidth: '2px' },
                markerEnd: {
                    type: MarkerType.ArrowClosed,
                },
                data: {
                    edge,
                    isColumnLineage: false,
                    isPipelineRootNode: !isNil(edge.pipeline) ? entityFqn === edge.pipeline?.fullyQualifiedName : false,
                },
            });
        }
    })
    // 返回结果 
    return {  
        edges: lineageEdgesV1,  // 连接线集合
        columnsHavingLineage: Array.from(columnsHavingLineage),  // 字段上下关联的具体字段id
    };
}

// 匹配血缘的呈现类型（输入方、输出方）
const getNodeType = (edgesData, id) => {
    const hasDownStreamToEntity = edgesData.find((down) => down.toEntity.id === id);
    const hasDownStreamFromEntity = edgesData.find((down) => down.fromEntity.id === id);
    const hasUpstreamFromEntity = edgesData.find((up) => up.fromEntity.id === id);
    const hasUpstreamToEntity = edgesData.find((up) => up.toEntity.id === id);
    if (hasDownStreamToEntity && !hasDownStreamFromEntity) {
        return EntityLineageNodeType.OUTPUT;
    }
    if (hasUpstreamFromEntity && !hasUpstreamToEntity) {
        return EntityLineageNodeType.INPUT;
    }
    return EntityLineageNodeType.DEFAULT;
}

// 计算节点高度和字段对象
export const getEntityChildrenAndLabel = (
    node,
    expandAllColumns = false, 
    columnsHavingLineage = []
) => {
    // 容错处理，没有节点返回空对象
    if (!node) {
        return {
            children: [],
            childrenHeading: '',
            childrenHeight: 0,
            childrenFlatten: [],
        }
    }
    // 获取对应的数据类型值
    const entityMappings = {
        [EntityType.TABLE]: {
            data: node.columns ?? [],
            label: t('label.column-plural'),
          },
      [EntityType.DASHBOARD]: {
            data: node.charts ?? [],
            label: t('label.chart-plural'),
          },
      [EntityType.MLMODEL]: {
            data: node.mlFeatures ?? [],
            label: t('label.feature-plural'),
          },
      [EntityType.DASHBOARD_DATA_MODEL]: {
            data: node.columns ?? [],
            label: t('label.column-plural'),
          },
      [EntityType.CONTAINER]: {
            data: node.dataModel?.columns ?? [],
            label: t('label.column-plural'),
          },
      [EntityType.TOPIC]: {
            data: node.messageSchema?.schemaFields ?? [],
            label: t('label.field-plural'),
          },
      [EntityType.SEARCH_INDEX]: {
            data: node.fields ?? [],
            label: t('label.field-plural'),
          },
    }
    const { data, label } = entityMappings[node.entityType] || {
        data: [],
        label: '',
    };

    // 计算字段布局高度和全量字段信息
    const { totalHeight, flattened } = calculateHeightAndFlattenNode(data, expandAllColumns, columnsHavingLineage)

    // 返回结果
    return {
        children: data,
        childrenHeading: label,
        childrenHeight: totalHeight,
        childrenFlatten: flattened
    }
}

// 计算节点高度和打平字段对象
const calculateHeightAndFlattenNode = (
    children,
    expandAllColumns = false,
    columnsHavingLineage = []
) => {
    let totalHeight = 0
    let flattened = []

    children.forEach(item => {
        // 节点有字段就累加高度
        if (
            expandAllColumns ||
            columnsHavingLineage.includes(item.fullyQualifiedName || '') !== -1
        ) {
            totalHeight += 27
        }
        flattened.push(item)
        
        // 递归计算子级关联的字段集
        if (item.children && item.children.length > 0) {
            const childResult = calculateHeightAndFlattenNode(item.children, expandAllColumns, columnsHavingLineage)
            totalHeight += childResult.totalHeight
            flattened = flattened.concat(childResult.flattened)
        }
    })

    return { totalHeight, flattened }
}

// 检查排除空数据
const removeDuplicateNodes = (nodesData) => {
    const uniqueNodesMap = new Map()
    nodesData.forEach((node) => {
      if (node?.fullyQualifiedName) {
        uniqueNodesMap.set(node.fullyQualifiedName, node);
      }
    });
  
    const uniqueNodesArray = Array.from(uniqueNodesMap.values());
  
    return uniqueNodesArray;
};

// 名称容错
export const getEntityName = (entity) => {
    return entity?.displayName || entity?.name || '';
}

// 处理节点超出限制数量
const flattenObj = (
    entityObj,  // 血缘全量数据
    childMapObj,
    currentId,  // 源节点ID
    nodes,
    edges,
    pagination_data,
    config  // 上下游血缘呈现配置
) => {
    const { downwards, maxLineageLength = 50 } = config
    // 读取对应上下游节点
    const children = downwards ? childMapObj.children : childMapObj.parents
    // 容错处理
    if (!children) { return }
    
    // 开始位置（pagination_data关联方法（加载更多节点）提供）
    const startIndex = pagination_data[currentId]?.[downwards ? 'downstream' : 'upstream'][0] ?? 0
    // 是否超出限制
    const hasMoreThanLimit = children.length > startIndex + maxLineageLength
    // 结束位置
    const endIndex = startIndex + maxLineageLength

    // 截取范围内的节点数量
    children.slice(0, endIndex).forEach(item => {
        if(item) {
            // 递归计算每个层级累计出范围节点数量
            flattenObj(entityObj, item, item.id, nodes, edges, pagination_data, {
                downwards,
                maxLineageLength
            })
            // 保存节点
            nodes.push(item)
        }
    })
    
    // 超出限制范围需要手动添加一个加载更多节点
    if(hasMoreThanLimit) {
        // 生成节点唯一 ID
        const moreNodeId = `loadmore_${uniqueId('node_')}_${currentId}_${startIndex}`
        const childrenLength = children.length - endIndex
        // 生成节点对象
        const moreNode = {
            descrition: '加载更多',
            displayName: 'Load More',
            name: `load_more_${currentId}`,
            fullyQualifiedName: `load_more_${currentId}`,
            id: moreNodeId,
            type: 'load-more',
            pagination_data: {
                index: endIndex,
                parentId: currentId,
                childrenLength,
            },
            edgesType: downwards ? 'downstream' : 'upstream'
        }
        // 保存节点
        nodes.push(moreNode)
        // 生成连线对象
        const moreEdge = {
            fromEntity: {
                fqn: '',
                id: downwards ? currentId : moreNodeId,
                type: ''
            },
            toEntity: {
                fqn: '',
                id: downwards ? moreNodeId : currentId,
                type: ''
            }
        }
        // 保存连线
        edges.push(moreEdge)
    }
}

// 整合血缘关系对象
const getLineageChildParents = (
    lineageData,  // 全量数据（节点，连线）
    nodeSet,
    parsedNodes,
    currentId,
    isParent = true,
    index = 0,
    depth = 1
) => {
    // 根据isParent 区分处理的是上游还是下游，获取相应方向的连线数组
    const edges = isParent ? lineageData?.upstreamEdges || [] : lineageData?.downstreamEdges || []
    // 过滤出对应的上下游连线对象
    const filtered = edges.filter(edge => isParent ? edge.toEntity.id === currentId : edge.fromEntity.id === currentId)

    return filtered.reduce((childMap, edge, i) => {
        // 根据连线匹配出对应的节点
        const node = lineageData.nodes?.find(node => isParent ? node.id === edge.fromEntity.id : node.id === edge.toEntity.id)
        // 性能优化：有节点 + nodeSet没有记录
        if (node && !nodeSet.has(node.id)) {
            nodeSet.add(node.id)
            // 保存解析后的节点对象
            parsedNodes.push({
                ...node,
                direction: isParent ? 'upstream' : 'downstream', // 上下游标识
                depth, // 当前层级
            })
            const childNodes = getLineageChildParents(
                lineageData,
                nodeSet,
                parsedNodes,
                node.id,
                isParent,
                i,
                depth + 1  // 每次递归层级都+1
            )

            // 当前处理的节点对象
            const lineage = { ...node, pageIndex: index + i }
            // 赋值对应的上下游关系节点
            if(isParent) {
                lineage.parents = childNodes
            } else {
                lineage.children = childNodes
            }
            // 整合到一个数组种
            childMap.push(lineage)
        }

        // 返回结果
        return childMap
    }, [])
}

// 血缘上下游分类
export const getUpstreamDownstreamNodesEdges = (edges, nodes, currentName) => {
    // 上游连线对象
    const upstreamEdges = []
    // 下游连线对象
    const downstreamEdges = []
    // 上游节点对象
    const upstreamNodes = []
    // 下游节点对象
    const downstreamNodes = []

    // 当前选中的节点（默认源节点）
    const activeNode = nodes.find(node => node.fullyQualifiedName === currentName)

    // 如果取消选中就直接返回
    if (!activeNode) {
        return { upstreamEdges, downstreamEdges, upstreamNodes, downstreamNodes }
    }

    // 整理出上游数据
    function findUpstream(node) {
        // 直接关系的上游
        const directDownstream = edges.filter(edge => edge.toEntity.fqn === node.fullyQualifiedName)
        upstreamEdges.push(...directDownstream)
        // 筛选出对应的节点
        directDownstream.forEach(edge => {
            const toNode = nodes.find(item => item.fullyQualifiedName === edge.fromEntity.fqn)
            // 过滤假值
            if(!isUndefined(toNode)) {
                // 防止节点重复
                if(!upstreamNodes.includes(toNode)) {
                    upstreamNodes.push(toNode)
                    // 递归获取有关系的节点
                    findUpstream(toNode)
                }
            }
        })
    }

    // 整理出下游数据
    function findDownstream(node) {
        // 直接关系的下游
        const directDownstream = edges.filter(edge => edge.fromEntity.fqn === node.fullyQualifiedName)
        downstreamEdges.push(...directDownstream)
        // 筛选出对应的节点
        directDownstream.forEach(edge => {
            const toNode = nodes.find(item => item.fullyQualifiedName === edge.toEntity.fqn)
            // 过滤假值
            if(!isUndefined(toNode)) {
                // 防止节点重复
                if(!downstreamNodes.includes(toNode)) {
                    downstreamNodes.push(toNode)
                    // 递归获取有关系的节点
                    findDownstream(toNode)
                }
            }
        })
    }

    findUpstream(activeNode)
    findDownstream(activeNode)

    return { upstreamEdges, downstreamEdges, upstreamNodes, downstreamNodes }
}

// 居中画布
export const centerNodePosition = (
  node,
  reactFlowInstance
) => {
  const { position, width } = node;
  
  reactFlowInstance?.setCenter(
    position.x + (width ?? 1 / 2),
    position.y + NODE_HEIGHT / 2,
    {
      zoom: ZOOM_VALUE,
      duration: ZOOM_TRANSITION_DURATION,
    }
  );
};

// 归类正常连线和字段连线
export const getClassifiedEdge = (edges) => {
    return edges.reduce(
      (acc, edge) => {
        // 有句柄的是字段连线，没句柄的是正常连线
        if (isUndefined(edge.sourceHandle) && isUndefined(edge.targetHandle)) {
          acc.normalEdge.push(edge);
        } else {
          acc.columnEdge.push(edge);
        }
  
        return acc;
      },
      {
        normalEdge: [],
        columnEdge: [],
      }
    );
};

// 获取所有的关联的字段连接线
export const getAllTracedColumnEdge = (column, columnEdge) => {
    const incomingColumnEdges = getAllTracedEdges(column, columnEdge, [], true);
    const outGoingColumnEdges = getAllTracedEdges(column, columnEdge, [], false);
  
    return {
      incomingColumnEdges,
      outGoingColumnEdges,
      connectedColumnEdges: [
        column,
        ...incomingColumnEdges,
        ...outGoingColumnEdges,
      ],
    };
};

// 获取所有的关联连接线
const getAllTracedEdges = (
    selectedColumn,  // 选中的字段
    edges,  // 字段的连接线
    prevTraced = [],  // 追溯上一条连接线
    isIncomer  // 输入还是输出
  ) => {
    const tracedNodes = getTracedEdge(selectedColumn, edges, isIncomer);
  
    return tracedNodes.reduce((memo, tracedNode) => {
      memo.push(tracedNode);
  
      if (prevTraced.findIndex((n) => n === tracedNode) === -1) {
        prevTraced.push(tracedNode);
  
        getAllTracedEdges(tracedNode, edges, prevTraced, isIncomer).forEach(
          (foundNode) => {
            memo.push(foundNode);
  
            if (prevTraced.findIndex((n) => n === foundNode) === -1) {
              prevTraced.push(foundNode);
            }
          }
        );
      }
  
      return memo;
    }, []);
}

// 匹配有关联的连接线
const getTracedEdge = (
    selectedColumn,
    edges,
    isIncomer
  ) => {
    if (isEmpty(selectedColumn)) {
      return [];
    }
  
    const tracedEdgeIds = edges
      .filter((e) => {
        const { sourceHandle, targetHandle } = getColumnSourceTargetHandles(e);
        const id = isIncomer ? targetHandle : sourceHandle;
  
        return id === selectedColumn;
      })
      .map((e) => {
        const { sourceHandle, targetHandle } = getColumnSourceTargetHandles(e);
  
        return isIncomer ? sourceHandle ?? '' : targetHandle ?? '';
      });
  
    return tracedEdgeIds;
};

// 获取布局的属性（！）
export const getLayoutedElements = (
    elements,
    direction = EntityLineageDirection.LEFT_RIGHT,
    isExpanded = true,
    expandAllColumns = false,
    columnsHavingLineage = []
) => {
    const Graph = graphlib.Graph;
    const dagreGraph = new Graph();
    dagreGraph.setDefaultEdgeLabel(() => ({}));
    dagreGraph.setGraph({ rankdir: direction });

    const isHorizontal = direction === EntityLineageDirection.LEFT_RIGHT;
    const nodeSet = new Set(elements.node.map((item) => item.id));

    const nodeData = elements.node.map((el) => {
        const { childrenHeight } = getEntityChildrenAndLabel(
          el.data.node,
          expandAllColumns,
          columnsHavingLineage
        );
        const nodeHeight = isExpanded ? childrenHeight + 220 : NODE_HEIGHT;
    
        dagreGraph.setNode(el.id, {
          width: NODE_WIDTH,
          height: nodeHeight,
        });
    
        return {
          ...el,
          nodeHeight,
          childrenHeight,
        };
    });

    const edgesRequired = elements.edge.filter(
        (el) => nodeSet.has(el.source) && nodeSet.has(el.target)
    );
    edgesRequired.forEach((el) => dagreGraph.setEdge(el.source, el.target));

    layout(dagreGraph);

    const uNode = nodeData.map((el) => {
        const nodeWithPosition = dagreGraph.node(el.id);

        return {
                ...el,
                targetPosition: isHorizontal ? Position.Left : Position.Top,
                sourcePosition: isHorizontal ? Position.Right : Position.Bottom,
                position: {
                x: nodeWithPosition.x - NODE_WIDTH / 2,
                y: nodeWithPosition.y - el.nodeHeight / 2,
            },
        };
    });

    return { node: uNode, edge: edgesRequired };
}

// 重制视图位置
export const onLoad = (reactFlowInstance) => {
    reactFlowInstance.fitView();
    reactFlowInstance.zoomTo(ZOOM_VALUE);
};

// export const getBreadcrumbsFromFqn = (fqn, includeCurrent = false) => {
//     const fqnList = Fqn.split(fqn);
//     if (!includeCurrent) {
//       fqnList.pop();
//     }
  
//     return [
//       ...fqnList.map((fqn) => ({
//         name: fqn,
//         url: '',
//       })),
//     ];
//   };

// export const getServiceIcon = (source) => {
//     const isDataAsset = NON_SERVICE_TYPE_ASSETS.includes(source.entityType);
  
//     if (isDataAsset) {
//       return searchClassBase.getEntityIcon(
//         source.entityType ?? '',
//         'service-icon w-7 h-7',
//         {
//           color: DE_ACTIVE_COLOR,
//         }
//       );
//     } else {
//       return (
//         <img
//           alt="service-icon"
//           className="inline service-icon h-7"
//           src={serviceUtilClassBase.getServiceTypeLogo(source)}
//         />
//       );
//     }
// };
