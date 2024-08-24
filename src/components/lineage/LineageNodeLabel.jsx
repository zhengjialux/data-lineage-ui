import { Space, Row, Col, Typography } from 'antd'
import { getEntityName } from './lineageUtils'
import React, { useEffect, useState } from 'react'
import { t } from 'i18next';
import './lineage-node-label.less';

  
  const LineageNodeLabel = ({ node }) => {
    const [breadcrumbs, setBreadcrumbs] = useState([])

    useEffect(() => {
      const fullyQualifiedName = node.fullyQualifiedName?.split('.')
      setBreadcrumbs(fullyQualifiedName.slice(0, fullyQualifiedName.length - 1))
    }, [])
  
    return (
      <div className="w-76">
        <div className="m-0 p-x-md p-y-xs">
          <div className="d-flex gap-2 items-center m-b-xs">
            <Space
              wrap
              align="start"
              className="lineage-breadcrumb w-full"
              size={4}>
              {breadcrumbs.map((breadcrumb, index) => (
                <React.Fragment key={breadcrumb}>
                  <Typography.Text
                    className="text-grey-muted lineage-breadcrumb-item"
                    ellipsis={{ tooltip: true }}>
                    {breadcrumb}
                  </Typography.Text>
                  {index !== breadcrumbs.length - 1 && (
                    <Typography.Text className="text-xss">
                      {t('label.slash-symbol')}
                    </Typography.Text>
                  )}
                </React.Fragment>
              ))}
            </Space>
          </div>
        </div>
      </div>
    );
  };

export default LineageNodeLabel